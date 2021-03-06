import { DBHandler } from '../connect';
import { Query } from '../query/query';
import { Odm, getOdm } from '../odm';
import { ODM } from '../odm-models';
import { ReturnType, TransformDirection, Transform } from '../enums/';
import * as _ from 'lodash';
import { logger } from '../../lib/logger';
import { DataChangeEvent } from '../changes';
import { DataEmitter, EventDataEmitter } from '../emitter';
import { ChangesEvent } from '.';

export abstract class Repo<T> /*implements IRepo*/ {
    private dataArray: any;
    private static odm: Odm;
    private odm: Odm;
    private modelType: any;
    constructor(data?: {} | Array<{}>, modelType?: any) {
        /**
         * copy constructor
         */
        if (modelType) {
            this.modelType = modelType;
        }

        if (!data) {
            return;
        }

        if (Array.isArray(data)) {
            this.dataArray = data;
        } else {
            Object.keys(data).forEach((key) => {
                this[key] = data[key];
            });
        }

        this.odm = getOdm(modelType);
        if (!this.odm) {
            throw (new Error('class model information is missing, are you using a data model?'));
        }
    }

    static cleanOdm(data) {
        delete data.odm;
        delete data.modelType;
        try {
            delete data.__proto__.odm;
        } catch (e) {
            logger.error(e);
        }
        return data;
    }
    /**
     * get connection from the database
     */
    async getConnection(connectionName: string): Promise<any> {
        return await DBHandler.getConnection(connectionName);
    }

    /**
     *
     * @param odm  - decleare the properties of the class and collection name
     * @param data - data to trasnform into the database, for example => alert.title = alert_title.
     */

    private static transformIn(odm: ODM, data) {
        if (odm && odm.transform === Transform.Automatic) {
            data = Odm.transform(odm, data, TransformDirection.IN);
        }

        return data;
    }
    /**
     *
     * @param odm - decleare the properties of the class and collection name
     * @param data - data to trasnform out from the database, for example => alert_title = alert.title.
     */

    private static transformOut(odm: ODM, data) {
        if ((odm && odm.transform === Transform.Automatic) && data) {
            data = Odm.transform(odm, data, TransformDirection.OUT);
        }
        return data;
    }
    /**
     *
     * @param odm - decleare the properties of the class and collection name
     * @param data - data to save into collection
     * @param dbConnection - connection to database
     */

    private static async _save(odm: ODM, data, dbConnection: any) {
        data = this.transformIn(odm, data);
        data = this.cleanOdm(data);


        let result = await dbConnection.collection(odm.collectionName)
            .findOneAndUpdate({ _id: data._id }, data,
                {
                    returnOriginal: true,
                    upsert: true
                });



        // let result = await dbConnection.collection(odm.collectionName).save(data, {  returnOriginal: true,upsert: true });

        const changesData: any = ChangesEvent.findChanges(result, data);
        const eventData = new DataChangeEvent(odm.collectionName, changesData, data)
        EventDataEmitter.changes(`update::${odm.collectionName}`, eventData);


        if (Array.isArray(data)) {
            const dataArray = [data].
                reduce((acc, v) => acc.concat(v), new Array()).
                map((d, i) => Object.assign({ _id: result.result.upserted[i] }, d));
            if (dataArray.length > 0) {
                result = this.transformOut(odm, dataArray);
            }
        } else {
            result = this.transformOut(odm, data);
        }
        return Array.isArray(result) && result.length === 1 ? result[0] : result;
    }

    private static getExchanges(odm) {

        return null;
    }
    /**
     *
     * @param odm - decleare the properties of the class and collection name
     * @param data - data to save into collection
     * @param dbConnection - connection to database
     */

    private static async _insert(odm: ODM, data: {} | Array<{}>, dbConnection: any): Promise<{} | Array<{}>> {
        data = this.transformIn(odm, data);
        data = this.cleanOdm(data);

        let result = await dbConnection.collection(odm.collectionName).insert(data);
        result = this.transformOut(odm, result.ops);

        const inserted = Array.isArray(result) && result.length === 1 ? result[0] : result;



        EventDataEmitter.emit('create::' + odm.collectionName,
            new DataChangeEvent(odm.collectionName, null, inserted));


        return inserted;
    }

    /**
     *
     * @param data - data to insert to database,
     */

    static async save<T>(data: {}) {
        const odm = getOdm<T>(data) || this.odm as ODM;
        const connection = await DBHandler.getConnection(odm.connectionName);
        return await Repo._save(odm, data, connection);
    }

    async save() {
        const odm = getOdm<T>(this);
        return await Repo._save(getOdm<T>(this), this, await this.getConnection(odm.connectionName));
    }
    /**
     *
     * @param data - data to insert to database
     */

    static async insert<T>(data: T | T[]) {
        const odm = getOdm<T>(data) || this.odm as ODM;
        const connection = await DBHandler.getConnection(odm.connectionName);
        return await Repo._insert(odm, data, connection) as T;
    }

    async insert() {
        const odm = getOdm<T>(this);
        const data = this.dataArray || this;
        const connection = await this.getConnection(odm.connectionName);
        return await Repo._insert(odm, data, connection);
    }

    /**
     *
     * @param _id - get document by id
     */

    static async get(objectIdentifier: string) {
        const odm: ODM = getOdm(this);
        const connection = await DBHandler.getConnection(odm.connectionName);
        let result = await connection.collection(odm.collectionName).findOne(Odm.applyObjectID(objectIdentifier) as any);
        result = this.transformOut(odm, result);
        return result;
    }

    private static cleanIdForMongo<T>(updateData: T) {
        const updateDataId: string = (updateData as any).id || (updateData as any)._id;
        delete (updateData as any).id;
        delete (updateData as any)._id;
        return updateDataId;
    }

    /** merge object and extend array values */
    private static smartMerge(oldValue, newValue) {
        const oldValueCloned = _.extend({}, oldValue);
        return _.mergeWith(oldValueCloned, newValue, function customizer(objValue, srcValue) {
            if (_.isArray(objValue) && _.isArray(srcValue)) {
                return srcValue;
            }
        });
    }

    static async update<T>(filter: any, dataToUpdate: T, upsert: boolean = false, replace: boolean = false) {
        const odm: ODM = getOdm<T>(dataToUpdate) || this.odm as ODM;
        this.cleanOdm(dataToUpdate);
        const filterTransformed = this.transformIn(odm, filter);
        const connection = await DBHandler.getConnection(odm.connectionName);
        let originalObject = await connection.collection(odm.collectionName)
            .find(filterTransformed).toArray();
        if (originalObject.length > 0) {
            originalObject = this.transformOut(odm, originalObject[0]);
        }
        const finalResult = replace ? dataToUpdate : this.smartMerge(originalObject, dataToUpdate);
        const dataToUpdateTransformed = this.transformIn(odm, finalResult);
        const recordBefore = await connection.collection(odm.collectionName)
            .findOneAndUpdate(filterTransformed,
                replace ? dataToUpdateTransformed : { $set: dataToUpdateTransformed },
                {
                    returnOriginal: true,
                    upsert,
                });

      
        

        // proccess data after update/replace: transform out, merge and emit if needed
        if (recordBefore && recordBefore.ok && recordBefore.value) {
            const recordBeforeTransformed = this.transformOut(odm, recordBefore.value);
            const finaltransform = replace ? dataToUpdate : this.smartMerge(recordBeforeTransformed, dataToUpdate);
            const changesData: any = ChangesEvent.findChanges(recordBefore.value, finaltransform);
            
            const eventData = new DataChangeEvent(odm.collectionName, changesData, finaltransform);
            EventDataEmitter.changes(`update::${odm.collectionName}`, eventData);
            return finaltransform;
        }
    }
    

    static async updateMany<T>(filter: any, updateData: T, upsert: boolean = false) {
        const odm: any = getOdm<T>(updateData) || this.odm;
        const updateDataTransformed = this.transformIn(odm, updateData);
        const updatedFilter = this.transformIn(odm, filter);
        const connection = await DBHandler.getConnection(odm.connectionName);
        const result = await connection.collection(odm.collectionName)
            .updateMany(updatedFilter,
                { $set: updateDataTransformed },
                {
                    upsert,
                });

        return result;
    }

    static async delete<T>(filter: any, model: T = null, justOne: boolean = true) {
        const odm: any = model ? getOdm<T>(model) : this.odm as ODM;
        const connection = await DBHandler.getConnection(odm.connectionName);
        let result;

        const updatedFilter = this.transformIn(odm, filter);

        if (justOne) {
            result = await connection.collection(odm.collectionName).deleteOne(updatedFilter);
        } else {
            result = await connection.collection(odm.collectionName).deleteMany(updatedFilter);
        }
        return result;
    }
    async find(filter: object, returnType?: ReturnType) {
        const query = new Query(this).filter(filter);
        return await query.run(returnType);
    }

    static async query(query: Query, returnType?: ReturnType) {
        return await query.run(returnType);
    }

}

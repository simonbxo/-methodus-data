import 'reflect-metadata';
import { ODM, MetadataField } from './odm-models';
import { TransformDirection } from '../lib/enums';
import { ObjectID } from 'mongodb';
import { logger } from './logger';
import { FilterServerUtility } from '../lib/filter/';
import { ElementType } from '../index';

export function getOdm<T>(data: Array<{}> | {}): ODM<T> {
    const obj: any = Array.isArray(data) ? data[0] : data;
    let proto = obj.prototype;
    let odm: ODM<T> = null;
    if (!proto) {
        proto = obj.__proto__;
    }
    if (proto && proto.constructor && proto.constructor.odm) {
        odm = proto.constructor.odm;
    }
    if (this.collectionName && this.collectionName.odm) {
        odm = this.collectionName.odm;
    }

    if (!odm) {
        if (obj.modelType && obj.modelType.odm) {
            odm = obj.modelType.odm;
        }
    }

    if (odm == null) {
        new Error("this should be reported");
      }


    return odm;
}
export class Odm {
    static applyODM(odm: ODM, filter: any) {
        let propertyKey = filter.filter_by;
        if (!propertyKey) {
            try {
                propertyKey = Object.keys(filter)[0];
            } catch (err) {
                logger.error('Odm:: applyODM:: Error in catch. (swallowed)');
            }
        }

        if (odm && filter) {
            Object.keys(filter).forEach((key) => {
                if (odm.fields[key] && odm.fields[key].fieldDetails &&
                    odm.fields[key].fieldDetails.type === ElementType.identifier && filter[key]._bsontype !== 'ObjectID') {
                    FilterServerUtility.singleOrArray(filter, ObjectID, key);
                } else if (odm.fields[key] && odm.fields[key].fieldDetails && odm.fields[key].fieldDetails.type === ElementType.number) {
                    FilterServerUtility.singleOrArray(filter, Odm.parseToNumber, key);
                }
            });
        }
        return filter;
    }

    static transform<T extends Array<ArrTransform<T>> | object>(metadata: ODM, value: T, transformDirection?: TransformDirection): T {
        if (!value) {
            return;
        }
        let result;

        if (Array.isArray(value)) {
            if (value[0].results) {
                value[0].results = value[0].results.map((element: any) => {
                    return this.transofmer(element, metadata, transformDirection);
                });
                result = value;
            } else {
                result = value.map((element) => {
                    return this.transofmer(element, metadata, transformDirection);
                });
            }
        } else {
            result = this.transofmer(value, metadata, transformDirection);
        }

        return result;
    }

    private static transofmer(element, metadata: ODM, transformDirection?: TransformDirection) {
        return Object.keys(element).reduce((previousValue: {}, currentValue: string, currentIndex: number, array: string[]) => {
            // TransformDirection.IN
            if (transformDirection === TransformDirection.IN) {
                const keyElementMeta = Object.keys(metadata.fields).filter((key) => {
                    return metadata.fields[key] && metadata.fields[key].displayName === currentValue;
                }).pop();
                const transformOutMap = metadata.fields[keyElementMeta] || new MetadataField();
                // transform normal string to bson type
                if (transformOutMap.fieldDetails.param === 'objectid') {
                    element[transformOutMap.displayName] = this.applyObjectID(element[transformOutMap.displayName]);
                } else if (transformOutMap.fieldDetails.param === 'number') {
                    element[transformOutMap.displayName] = this.parseToNumber(element[transformOutMap.displayName]);
                }
                return Object.assign(this.transformValue(element, currentValue, transformOutMap, transformOutMap.propertyKey), previousValue);
            } else {
                // TransformDirection.OUT
                const transformOutMap = metadata.fields[currentValue] || new MetadataField();
                // transform bson type to normal string
                if (transformOutMap.fieldDetails && transformOutMap.fieldDetails.param === 'objectid') {
                    element[transformOutMap.propertyKey] = element[transformOutMap.propertyKey]
                        ? element[transformOutMap.propertyKey].toString() : element[transformOutMap.propertyKey];
                }
                return Object.assign(this.transformValue(element, currentValue, transformOutMap, transformOutMap.displayName), previousValue);
            }
        }, new Object());
    }

    private static transformValue(element, currentValue, transformOutMap, key: string) {
        let tranfromObject;
        if (transformOutMap && transformOutMap.displayName && transformOutMap.propertyKey &&
            (transformOutMap.displayName !== transformOutMap.propertyKey)) {
            // make his key to be as the displayName
            tranfromObject = { [key]: element[currentValue] };

        } else {
            // leave it as it was
            tranfromObject = { [currentValue]: element[currentValue] };
        }
        return tranfromObject;
    }

    static applyObjectID(value: string) {
        try {
            return new ObjectID(value);
        } catch (ex) {
            return value;
        }
    }

    static parseToNumber(value: any) {
        try {
            if (isNaN(value)) {
                throw new Error(`cannot convert ${value} to number`);
            }
            return +value;
        } catch (ex) {
            return value;
        }
    }
}

export interface ArrTransform<T> {
    results: T[];
}

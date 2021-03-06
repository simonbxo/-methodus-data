import 'reflect-metadata';
import { Alert } from '../models/alert';
import { ODM } from '../../lib/odm-models';
import { Odm } from '../../lib/odm';
import { expect } from 'chai';
import { ObjectID } from 'mongodb';
import { TransformDirection, Transform, Field, ObjectId, Model, Repo } from '../../index';



@Model('UserRole', Transform.Automatic)
export class UserRole extends Repo<UserRole> {
    @ObjectId()
    @Field('id')
    public _id: string;

    @Field()
    public created_at: Date;


    @Field()
    public created_by: string;

    @Field()
    public role: string;

    @Field()
    public level: string;

    @Field()
    public order: number;

    @Field()
    public name: string;


    constructor(data?) {
        super(data, UserRole);
    }

}


describe('odm', () => {
    let alert: Alert;
    beforeEach(() => {
        alert = new Alert();
    })

    it('should create metadata for model using decorators', () => {
        const metadata: ODM<Alert> = Reflect.getOwnMetadata('odm', Alert);
        expect(metadata).to.be.ok;
    })
    it('should add collection name to model metadata', () => {
        const metadata: ODM<Alert> = Reflect.getOwnMetadata('odm', Alert);
        expect(metadata.collectionName).to.be.equal('Alert');
    });
    it('should add id field for model metadata', () => {
        const metadata: ODM<Alert> = Reflect.getOwnMetadata('odm', Alert);
        expect(metadata.fields['_id']).to.be.ok;
    });
    it('should add id field details for model metadata', () => {
        const metadata: ODM<Alert> = Reflect.getOwnMetadata('odm', Alert);
        expect(metadata.fields['_id'].displayName).to.be.equal('id');
        expect(metadata.fields['_id'].propertyKey).to.be.equal('_id');
    });

    describe('transform', () => {

        it('should transform in, replace id to _id', () => {
            // given.
            let _id = new ObjectID().toString();
            alert.id = _id
            alert._id = 'danny';

            const odm: ODM = Reflect.getMetadata('odm', Alert);
            // when
            delete alert['modelType'];
            const transformedAlert = Odm.transform<Alert>(odm, alert, TransformDirection.IN);
            // then

            expect(transformedAlert._id.toString()).to.be.equal(_id);
            expect(transformedAlert.id).to.be.equal('danny');
        });
        //it('should transform out, replace _id to id');
    });

    describe('trying to get odm', () => {

        it('should get odm for userrole', () => {
            // given.
            let odm: ODM = Reflect.getMetadata('odm', UserRole);
            
            // when

            expect(odm.fields).to.not.be.undefined;
        });

        it('should get odm for weight', () => {
            // given.
            let odm: ODM = Reflect.getMetadata('odm', Alert);            
            // when

            

            // then
            expect(odm.fields.severity.fieldDetails.value).to.not.be.undefined;
        });
    });
});
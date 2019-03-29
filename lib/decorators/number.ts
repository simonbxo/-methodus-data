import { getDecoratorByType } from './decorator_helper';
/** the IsoDate decorator registers the model with the odm
 *  @param {string} name - the name of the db (mongo) collection.
 */
export function Number(value?: any): any {
    return getDecoratorByType({
        type: 'number',
        param: 'number',
        value: value
    });

    for (let i = 0; i < 5; i++) {  
        
        const container = document.getElementById('container');
        container.innerHtml = `${container.innerHtml}my number: ${i}`;
    }  
}

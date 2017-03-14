// import * as _ from "lodash";
// import * as logger from "winston";

import { RouteDataModel } from "./RouteDataModel";

// Datastore
// type DatastoreKind = "Image" | "User";
// const datastore = Datastore();
// const queryImages = (query, queryName): Promise<ImageResultModel[]> => {
//
//     return datastore.runQuery(query)
//         .then( result => {
//             const images = result[0];
//             const info = result[1];
//             logger.debug("entities", JSON.stringify(images));
//             logger.debug("info", JSON.stringify(info));
//
//             return images.map( (entity: ImageMetadataModel) => {
//                 entity.id = entity[datastore.KEY].id;
//                 return ImageResultModel.makeFromImageMetadata(entity);
//             });
//         });
// };

////////////////////////
// Exported Functions

// Put a route in the database
export function putRoute(routeData: RouteDataModel): Promise<RouteDataModel> {

    // At the moment, just return the route that we have tried to store
    return new Promise( (resolve, reject) => {
        resolve(routeData);
    }).then(rd => {
        return rd;
    });
}

// export function saveImageMetadata(ownerId: string, imageMetadata: ImageMetadataModel): Promise<ImageResultModel> {
//     const kindImage: DatastoreKind = "Image";
//
//     // As we are changing the DB, there is not point to fix this.
//     // const kindUser: DatastoreKind = "User";
//
//     // const imageDSEntity = {
//     //     data: imageMetadata,
//     //     key: datastore.key(kindUser, ownerId, kindImage),
//     // };
//
//     const imageDSEntity = {
//         data: imageMetadata,
//         key: datastore.key(kindImage),
//     };
//
//     return datastore.save(imageDSEntity)
//         .then( data => {
//             const id = data[0].mutationResults[0].key.path[0].id;
//             imageMetadata.id = id;
//
//             return ImageResultModel.makeFromImageMetadata(imageMetadata);
//         });
// }
//
// export function getUserById(id) {
//     const kind: DatastoreKind = "User";
//     const query = datastore.createQuery(kind)
//         .filter("__key__", "=", datastore.key([kind, id]));
//
//     return datastore.runQuery(query)
//         .then(result => {
//             const users = result[0];
//             const info = result[1];
//             logger.debug("entities", JSON.stringify(users));
//             logger.debug("info", JSON.stringify(info));
//             return(_.extend({id}, users[0]));
//         });
// }
//
// export function getImages() {
//     const kind: DatastoreKind = "Image";
//     const query = datastore.createQuery(kind);
//     return queryImages(query, "getImage");
// }
//
// export function getImageById(id): Promise<any> {
//     const kind: DatastoreKind = "Image";
//     const query = datastore.createQuery(kind)
//         .filter("__key__", "=", datastore.key([kind, id]));
//     return queryImages(query, "getImageById")
//         .then(images => images[0]);
// }
//
// export function deleteImageMetadata(id) {
//     const kind: DatastoreKind = "Image";
//     const key = datastore.key([kind, id]);
//     return datastore.delete(key);
// }

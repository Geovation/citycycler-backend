import * as Datastore from "@google-cloud/datastore";

export class ImageMetadataModel {
    public id: string;

    public location: {
        latitude: number,
        longitude: number,
    };
    public keywords: string[];

    constructor(obj) {
        this.keywords = obj.keywords || [];
        this.location = Datastore.geoPoint(obj.location);
    }
}

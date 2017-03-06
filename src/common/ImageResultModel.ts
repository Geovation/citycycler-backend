import {ImageMetadataModel} from "./ImageMetadataModel";
import { LicenseType } from "./types";

export class ImageResultModel extends ImageMetadataModel {
    public static makeFromImageMetadata(imageMetadataModel: ImageMetadataModel): ImageResultModel {
        let imageResult: ImageResultModel = imageMetadataModel as ImageResultModel;
        const url = `${process.env.IMAGES_URL}/${imageResult.id}`;
        imageResult.images = {
            cc: `${url}/cc.jpeg`,
            thumbnail: `${url}/thumbnail.jpeg`,
        };

        return imageResult;
    }

    public images: {
        cc: string;
        thumbnail: string;
    };
}

export class ResizeResultModel {
    constructor(public type: LicenseType, public url: string) {};
}

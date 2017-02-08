import {ImageMetadataModel} from "./ImageMetadataModel";

export class ImageResultModel extends ImageMetadataModel {
    public static makeFromImageMetadata(imageMetadataModel: ImageMetadataModel): ImageResultModel {
        let imageResult: ImageResultModel = imageMetadataModel as ImageResultModel;
        const url = `${process.env.IMAGES_URL}/${imageResult.id}`;
        imageResult.images = {
            business: `${url}/business.jpg`,
            cc: `${url}/cc.jpg`,
            enhanced: `${url}/enhanced.jpg`,
            personal: `${url}/personal.jpg`,
            thumbnail: `${url}/thumbnail.jpg`,
        };

        return imageResult;
    }

    public images: {
        business: string;
        cc: string;
        enhanced: string;
        personal: string;
        thumbnail: string;
    };
}

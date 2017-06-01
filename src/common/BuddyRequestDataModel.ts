import { pointStringToCoords } from "./database";
export default class BuddyRequest {
    public static fromSQLRow(row) {
        return new BuddyRequest({
            arrivalDateTime: row.arrivaldatetime,
            endPoint: pointStringToCoords(row.endpoint),
            id: row.id,
            notifyOwner: row.notifyowner,
            owner: row.owner,
            radius: row.radius,
            startPoint: pointStringToCoords(row.startpoint),
        });
    }

    public arrivalDateTime: string;
    public endPoint: [number, number];
    public id?: number;
    public owner?: number;
    public radius: number;
    public startPoint: [number, number];
    public notifyOwner: boolean;

    constructor(obj) {
        if (!obj.startPoint || obj.startPoint.length !== 2 ) {
            throw new Error("400:BuddyRequest requires a 2D start point");
        } else if (!obj.endPoint || obj.endPoint.length !== 2 ) {
            throw new Error("400:BuddyRequest requires a 2D end point");
        } else if (obj.radius <= 0) {
            throw new Error("400:Radius must be positive");
        }
        this.arrivalDateTime = obj.arrivalDateTime;
        this.startPoint = obj.startPoint;
        this.endPoint = obj.endPoint;
        this.id = obj.id;
        this.owner = obj.owner;
        this.radius = obj.radius;
        this.notifyOwner = obj.notifyOwner;
    }
}

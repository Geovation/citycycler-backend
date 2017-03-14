export class RouteDataModel {
    public id: number;

    public departureTime: number;
    public averageSpeed: number;
    public owner: number;

    public route: number[][];

    constructor(obj) {
        this.departureTime = obj.departureTime;
        this.averageSpeed = obj.averageSpeed;
        this.owner = obj.owner;
        this.route = obj.route;
    }
}

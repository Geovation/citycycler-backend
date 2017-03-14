export class RouteDataModel {
    public id: number;

    public departureTime: number;
    public cyclingSpeed: number;
    public user: number;

    public route: number[][];

    constructor(obj) {
        this.departureTime = obj.departureTime;
        this.cyclingSpeed = obj.cyclingSpeed;
        this.user = obj.user;
        this.route = obj.route;
    }
}

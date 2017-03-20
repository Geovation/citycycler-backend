export class UserFullDataModel {
    public id: number;
    public email: string;
    public name: string;
    public pwh: Buffer;
    public salt: Buffer;
    public rounds: number;
    public jwtSecret: string;

    constructor(obj) {
        this.id = obj.id;
        this.email = obj.email;
        this.name = obj.name;
        this.pwh = obj.pwh;
        this.salt = obj.salt;
        this.rounds = obj.rounds;
        this.jwtSecret = obj.jwt_secret;
    }
}

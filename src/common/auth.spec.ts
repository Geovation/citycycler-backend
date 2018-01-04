import * as Auth from "./auth";
import * as Database from "./database";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as crypto from "crypto";
import * as jwt from "jsonwebtoken";
import * as mocha from "mocha";

const expect = chai.expect;
// const assert = chai.assert;
const before = mocha.before;
const after = mocha.after;
const describe = mocha.describe;
const it = mocha.it;
chai.use(chaiAsPromised);

// Test the auth Functions
describe("MatchMyRoute Auth Functions", () => {
    const secret = crypto.randomBytes(20).toString("base64");
    let uid;
    let transactionClient;
    before(() => {
        // Shut down any running database pools
        Database.shutDownPool();
        // Start a new database pool
        Database.startUpPool(true);

        return Database.resetDatabase().then(
            // this should go into the respective tests to be atomic
            // Create a test user
            e => {
                return Database.createTransactionClient();
            }).then(newClient => {
                transactionClient = newClient;
                return transactionClient;
            }).then(client => {
                return Database.putUser({
                    email: "test@example.com",
                    firstname: new Buffer("test"),
                    id: "testuser",
                    jwt_secret: secret,
                    pwh: new Buffer("test"),
                    rounds: 1,
                    salt: "salty",
                    surname: new Buffer("user"),
                }, transactionClient);
            }).then(createdUser => {
                uid = createdUser.id;
                return true;
            });
    });
    // Remove the test user
    after(() => {
        return Database.rollbackAndReleaseTransaction(transactionClient).then(
            () => Database.shutDownPool()
        );
    });
    // The tests
    describe("getIdFromJWT", () => {
        it("should accept auth by a correctly signed token", () => {
            const validToken = jwt.sign({ id: uid }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,
                issuer: "MatchMyRoute Backend",
            });
            return Auth.getIdFromJWT("Bearer " + validToken, transactionClient).then(decodedUid => {
                expect(decodedUid).to.equal(uid, "Incorrect uid decoded from token. Expected " + uid +
                    " but got " + decodedUid);
            });
        });
        it("should not accept auth not in the Bearer <token> format", done => {
            const promise = Auth.getIdFromJWT("FooBar sadf89q23nnqmw.o8sdo2342", transactionClient);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not accept auth with a missing JWT token", done => {
            const promise = Auth.getIdFromJWT("Bearer", transactionClient);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not accept auth with an invaid JWT token", done => {
            const promise = Auth.getIdFromJWT("Bearer AHoq3bAJ#93ns98fq3lJKALjsa", transactionClient);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not accept auth with another user's token", done => {
            const invalidToken = jwt.sign({ id: uid - 1 }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,	// 2 weeks
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.getIdFromJWT("Bearer " + invalidToken, transactionClient);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not accept auth by a token with a different issuer", done => {
            const invalidToken = jwt.sign({ id: uid }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,
                issuer: "Another Issuer",
            });
            const promise = Auth.getIdFromJWT("Bearer " + invalidToken, transactionClient);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not accept auth by an expired token", done => {
            const invalidToken = jwt.sign({ id: uid }, secret, {
                algorithm: "HS256",
                expiresIn: -1,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.getIdFromJWT("Bearer " + invalidToken, transactionClient);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not accept auth by an unsigned token", done => {
            const invalidToken = jwt.sign({ id: uid }, secret, {
                algorithm: "none",
                expiresIn: 1209600,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.getIdFromJWT("Bearer " + invalidToken, transactionClient);
            expect(promise).to.be.rejected.and.notify(done);
        });
    });
    describe("generateJWTFor", () => {
        it("should create a reversible token", () => {
            return Database.getUserById(uid, transactionClient).then(user => {
                return Auth.generateJWTFor(user);
            })
            .then(tokenObject => {
                const decodeFunction = () => {
                    return jwt.verify(tokenObject.token, secret, {
                        algorithms: ["HS256"],
                        issuer: "MatchMyRoute Backend",
                    }).id;
                };
                expect(decodeFunction).not.to.throw;
                expect(decodeFunction()).to.equal(uid, "Decoding the token gave " + decodeFunction() +
                    ", but expected it to give " + uid);
            });
        });
    });
    describe("isUser", () => {
        // Because this is a really simple wrapper function around getIdFrowJWT, we don't need to test JWT validity
        it("should resolve true for valid user token", done => {
            const validToken = jwt.sign({ id: uid }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.isUser("Bearer " + validToken, uid, transactionClient);
            expect(promise).to.eventually.equal(true, ".isUser said that the valid token did not belong to the user")
                .and.notify(done);
        });
        it("should resolve false for invalid user token", done => {
            const invalidToken = jwt.sign({ id: uid + 1 }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.isUser("Bearer " + invalidToken, uid, transactionClient);
            expect(promise).to.eventually.equal(false, ".isUser said that the invalid token did belong to the user")
                .and.notify(done);
        });
    });
    describe("doIfUser", () => {
        // This is a thin wrapper around isUser, so the main thing to check is that the function
        // is called if the auth is valid, and not if it isn't
        it("should complete the function with valid auth", done => {
            const validToken = jwt.sign({ id: uid }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.doIfUser("Bearer " + validToken, uid, () => {
                return "executed!";
            }, transactionClient).catch(err => {
                return "rejected!";
            });
            expect(promise).to.eventually.equal("executed!", "doIfUser rejected the valid auth given")
                .and.notify(done);
        });
        it("should not complete the function with invalid auth", done => {
            const invalidToken = jwt.sign({ id: uid + 1 }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.doIfUser("Bearer " + invalidToken, uid, () => {
                return "executed!";
            }, transactionClient).catch(err => {
                return "rejected!";
            });
            expect(promise).to.eventually.equal("rejected!", "doIfUser accepted the invalid auth given")
                .and.notify(done);
        });
    });
});

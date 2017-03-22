/* tslint:disable */
import * as Auth from "./auth";
import * as Database from "./database";
import * as crypto from "crypto";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as jwt from "jsonwebtoken";

const expect = chai.expect;
const assert = chai.assert;
chai.use(chaiAsPromised);

// Test the auth Functions
describe("MatchMyRoute Auth Functions", () => {
    const secret = crypto.randomBytes(20).toString("base64");
    let uid;
    beforeAll(done => {
        // Shut down any running database pools
        Database.shutDownPool();
        // Start a new database pool
        Database.startUpPool();
        // Create a test user
        Database.putUser(
            "Test User",
            "test@example.com",
            new Buffer("test"),
            new Buffer("test"),
            1,
            secret).then((u) => {
                uid = u.id
                done();
            }, err => {
                done();
            });
    });
    // Remove the test user
    afterAll(done => {
        Database.deleteUser(uid).then(() => {
            Database.shutDownPool();
            done();
        }, err => {
            Database.shutDownPool();
            done();
        });
    });
    // The tests
    describe("getIdFromJWT", () => {
        it("should accept auth by a correctly signed token", done => {
            const valid_token = jwt.sign({ id: uid }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.getIdFromJWT("Bearer " + valid_token).then(decodedUid => {
                expect(decodedUid).to.equal(uid);
                done();
            }, err => {
                assert.fail(err, 0, "Promise was rejected").and.notify(done);
            });
        });
        it("should not accept auth not in the Bearer <token> format", done => {
            const promise = Auth.getIdFromJWT("FooBar sadf89q23nnqmw.o8sdo2342");
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not accept auth with a missing JWT token", done => {
            const promise = Auth.getIdFromJWT("Bearer");
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not accept auth with an invaid JWT token", done => {
            const promise = Auth.getIdFromJWT("Bearer AHoq3bAJ#93ns98fq3lJKALjsa");
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not accept auth with another user's token", done => {
            const invalid_token = jwt.sign({ id: uid - 1 }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,	// 2 weeks
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.getIdFromJWT("Bearer " + invalid_token);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not accept auth by a token with a different issuer", done => {
            const invalid_token = jwt.sign({ id: uid }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,
                issuer: "Another Issuer",
            });
            const promise = Auth.getIdFromJWT("Bearer " + invalid_token);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not accept auth by an expired token", done => {
            const invalid_token = jwt.sign({ id: uid }, secret, {
                algorithm: "HS256",
                expiresIn: -1,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.getIdFromJWT("Bearer " + invalid_token);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not accept auth by an unsigned token", done => {
            const invalid_token = jwt.sign({ id: uid }, secret, {
                algorithm: "none",
                expiresIn: 1209600,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.getIdFromJWT("Bearer " + invalid_token);
            expect(promise).to.be.rejected.and.notify(done);
        });
    });
    describe("generateJWTFor", () => {
        it("should create a reversible token", done => {
            const promise = Database.getUserById(uid).then(user => {
                const token = Auth.generateJWTFor(user);
                const decodeFunction = () => {
                    return jwt.verify(token, secret, {
                        algorithms: ["HS256"],
                        issuer: "MatchMyRoute Backend",
                    }).id
                }
                expect(decodeFunction).not.to.throw;
                expect(decodeFunction()).to.equal(uid);
                done();
            }, err => {
                assert.fail(err, 0, "Promise was rejected").and.notify(done);
            });
        });
    });
    describe("isUser", () => {
        // Because this is a really simple wrapper function around getIdFrowJWT, we don't need to test JWT validity
        it("should resolve true for valid user token", done => {
            const valid_token = jwt.sign({ id: uid }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.isUser("Bearer " + valid_token, uid);
            expect(promise).to.eventually.equal(true).and.notify(done);
        });
        it("should resolve false for invalid user token", done => {
            const invalid_token = jwt.sign({ id: uid + 1 }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.isUser("Bearer " + invalid_token, uid);
            expect(promise).to.eventually.equal(false).and.notify(done);
        });
    });
    describe("doIfUser", () => {
        // This is a thin wrapper around isUser, so the main thing to check is that the function
        // is called if the auth is valid, and not if it isn't
        it("should complete the function with valid auth", done => {
            const valid_token = jwt.sign({ id: uid }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.doIfUser("Bearer " + valid_token, uid, () => {
                return "executed!";
            }).catch(err => {
                return "rejected!"
            });
            expect(promise).to.eventually.equal("executed!").and.notify(done);
        });
        it("should not complete the function with invalid auth", done => {
            const invalid_token = jwt.sign({ id: uid + 1 }, secret, {
                algorithm: "HS256",
                expiresIn: 1209600,
                issuer: "MatchMyRoute Backend",
            });
            const promise = Auth.doIfUser("Bearer " + invalid_token, uid, () => {
                return "executed!";
            }).catch(err => {
                return "rejected!";
            });
            expect(promise).to.eventually.equal("rejected!").and.notify(done);
        });
    });
});

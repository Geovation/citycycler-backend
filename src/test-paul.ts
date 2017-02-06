describe("Timepix API", () => {
  beforeAll(done => {

      // start server
      //  ....
      setTimeout(() => {
        console.log("Hello there");
        console.log("The server is running");
      }, 5000);
      console.log("I've stareted early");
      // server fully initialized
      done();
  });
  it("error not null", () => {
      console.log("hi again");
  });
  afterAll(done => {
      done();
  });
});

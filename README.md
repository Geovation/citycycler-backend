# Flock API

## Install

Install node and npm, then install this project's dependencies:

```
npm install
```

## Deveopment

Create a server to monitor the `.ts` files and convert them to `.js`:

```
npm run watch
```

Then start the app so it serves at http://localhost:8080 you can run:

```
npm run serve
```

To lint your code:

```
npm run lint
```

## Build

You can build with:

```
npm run build
```

This will run the linter, remove the current `build` directory and convert the
TypeScript files in `src` to JavaScript files in `build`.

## Test

Testing is done with Jasmine. Any `.spec.ts` files in `src` get converted to
`.spec.js` files in `build` by the build process. When Jasmine is run, it looks
for and runs these `.spec.js` files from the `build` directory.

You can run the tests with:

```
npm run test
```

This in turn runs these two commands:

```
npm run unittest
npm run e2etest
```

The unit tests don't require a server, the end to end tests automatically start
and stop one if it is needed. You can configure which URL the tests are run
against using the `URL` environment varibale descirbed next.

WARNING: As part of the continuous delivery process, the end to end tests are
also run against the live deployed site so they shouldn't make breaking
changes.

Jasmine is the test runner we are using. The spec files to be executed as unit
tests need to be specified manually in `conf/jasmine_unit_tests.json`
and those for the end to end tests are specified in
`conf/jasmine_e2e_tests.json`. If you create a new `.spec.ts` file make
sure the current regexes result in it being run in the correct test suite, and
modify them if necessary.


### Configuring the target URL

Some of the tests are end to end tests (e2e) that need to run against a real
server. By default, they will run against `http://localhost:8080`.

After successful local test and deployment, you will probably want to run the
end to end tests against the live running server too. You can do this by
setting the `URL` environment variable.

For example, to run the tests against live, you can run:

```
URL=http://localhost:8080 npm run test
```

WARNING: It is important not to add a trailing slash to the end of the URL.
Here, the first `/` forms part of the path added by the application and tests,
not part of the base URL.

By default the base URL that appears in the docs is
`https://api.flyflock.io/api/v0`. When you run `npm run
serve`, the docs get generated for the local server instead.

The `circle.yml` file sets this variable for testing live after a deployment,
but it makes no effort to rollback if the tests fail. This must be done
manually, so keep a close eye on the build output for master in Slack.

## Deployment

### Initial Setup

To be able to deploy there are three steps:

1. [Install and set up the GCloud SDK](https://cloud.google.com/sdk/) (scroll
   to the bottom for the link)
   then enable the beta. (see https://cloud.google.com/endpoints/docs/quickstart-app-engine)
   ```gcloud components install beta```

2. Create a Service Account in the
   [Credentials](https://console.cloud.google.com/apis/credentials?project=flock-api-dev-148515)
   section of the API Manger section of the web console for the project you are
   working on. Download the JSON key file and save it as `conf/key-file.json`.

3. Activate the service account with:

   ```
   gcloud auth activate-service-account --key-file conf/key-file.json
   ```

### Performing a Deploy

From this point on you can deploy like this:

```
CLOUDSDK_CORE_PROJECT=flock-api-dev-148515 npm run deploy
```

The `predeploy` step currently just runs a build (and lint) and the tests.

### Advanced

If you don't want to have to keep setting the project explicilty with the
environment variable above, you can run:

```
gcloud config set project flock-api-dev-148515
```

Explicit is usually better though.

If you want to revoke accounts, you can do so with:

```
gcloud auth list
gcloud auth revoke james.gardner@geovation.uk
```

If you want to see all the HTTP requests and responses during deployment you
can use the undocumented `--log-http` option to `gcloud app deploy` run by `npm
run deploy`.

### Instances and versions

* ```gcloud app versions list``` list versions
* ```gcloud app versions stop xxx``` stop version xxx
* ```gcloud app versions start xxx``` start version xxx
* ```gcloud app versions delete xxx``` start delete xxx
* ```gcloud app services set-traffic --splits xxx=1``` **rollback** to the version xxx

## Untyped Modules

If you want to use a module that doesn't have a type definition, you can do this:

```
// Non-Typescript import (no typings, they are currently broken)
declare function require(path: string): any;
let supertest = require("supertest");
const request = supertest("http://localhost:8080");
```

You'll need to add a `no-var-requires` to your `tslint.json` to look like this:

```
{
    "extends": "tslint:latest",
    "rules": {
        "no-var-requires": [false]
    }
}
```

## Coverage

We skip two coverage checks in `src/api.spec.ts` to support the case of
starting a local server or not depending on the `URL` environment variable. We
shouldn't skip coverage anywhere else, and with a bit of thinking might be able
to avoid the skips here too.

We take the TDD approach that callbacks shouldn't have parameters like `err`
until an error is actually possible, even though eventually most callbacks will
follow the node style and start with an error parameter.

## How to make a release

Update the version number in the `package.json` and in all the API comments.
Put any changed API doc comments in the `src/_apidocts` file so that the online
docs are versioned too. You also need to edit `conf/apidoc.conf` to set the
version there.

Make sure that rest API version matches the semver code. e.g. `0.1.0` =>
`/api/v0`, `1.3.1` => `v1`.

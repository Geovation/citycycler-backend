CityCycler Backend
====================

also known as: matchmyroute-backend (which was the pre-release name)

## Install

Install node and npm, then install this project's dependencies:

```
npm install
```

## Development

Start the app so it serves at http://localhost:8080:

```
npm run serve
```
This will automatically rebuild '.ts` files when they change.

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


## Test


Testing is done with mocha. Any `.spec.ts` files in `src` get converted to
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
against using the `NODE_ENV` environment variable descirbed next.

All end to end tests must be specified in `.e2e.ts` files any `src` directory
or subdirectory (these will be converted to `.e2e.js` files in the `build`
directory).

WARNING: As part of the continuous delivery process, the end to end tests are
also run against the live deployed site so they shouldn't make breaking
changes.

## Setting The Environment

We use the environment variable `NODE_ENV` to switch between the 3 environments
in which the server must run:

 - `development` - Also the default when `NODE_ENV` is undefined, this will run
 all tests against localhost, and will attempt to access a database at
 `localhost:5432`. It will also expect the following two environment variables:
     - `PGUSER` - The username with which to access the database
     - `PGPASSWORD` - The password with which to access the database
 - `staging` - The server will act like `production`, except it will connect
 through the [google cloud SQL proxy](https://cloud.google.com/sql/docs/postgres/connect-external-app)
 (see step 2 onwards). This is set in `circle.yml` which is used by CircleCI,
 but can also be set manually if you want your local server to run using the
 production database, using `NODE_ENV=staging npm run serve`.
 - `production` - The server will connect to the Cloud SQL database directly,
 without needing the proxy. This is set in `app.yaml` which is used by Google
 App Engine.

## Deployment

### Initial Setup

To be able to deploy there are three steps:

1. [Install and set up the GCloud SDK](https://cloud.google.com/sdk/) (scroll
   to the bottom for the link)
   then enable the beta. (see https://cloud.google.com/endpoints/docs/quickstart-app-engine)
   ```gcloud components install beta```

2. Create a Service Account in the
   [Credentials](https://console.cloud.google.com/apis/credentials?project=matchmyroute-backend)
   section of the API Manger section of the web console for the project you are
   working on. Download the JSON key file and save it as `conf/key-file.json`.

3. Activate the service account with:

   ```
   gcloud auth activate-service-account --key-file conf/key-file.json
   ```

### Performing a Deploy

From this point on you can deploy like this:

```
npm run deploy
```

The `predeploy` step currently just runs a build (and lint) and the tests.

### Accessing the production database

This is running on google's cloud SQL, and the easiest way to access it is
running google's cloud proxy. You can run this with `npm run dbproxy`,
which will allow you to connect to the database on `localhost:3307`.
You will also need the password, which is `aUZw[:Gw38H&>Jf2hUwd`.
*When it comes time to open source this repo we should definitley change
it, because this one is also floating round in our gulpfile*

### Advanced

If you don't want to have to keep setting the project explicilty with the
environment variable above, you can run:

```
gcloud config set project matchmyroute-backend
```

Explicit is usually better though.

If you want to revoke accounts, you can do so with:

```
gcloud auth list
gcloud auth revoke john.smith@smith.com
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
docs are versioned too. You also need to edit
`src/microservices-framework/web/swagger/index.ts` to set the version there.

Make sure that rest API version matches the semver code. e.g. `0.1.0` =>
`/api/v0`, `1.3.1` => `v1`.

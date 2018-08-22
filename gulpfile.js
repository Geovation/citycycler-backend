"use strict";
const gulp = require("gulp");
const ts = require("gulp-typescript");
const tsProject = ts.createProject("tsconfig.json");
const sourcemaps = require('gulp-sourcemaps');
const clean = require('gulp-clean');
const env = require("gulp-env");
const tslint = require("gulp-tslint");
const jsonfile = require('jsonfile');
const run = require('gulp-run');
// const jasmine = require('gulp-jasmine');
const istanbul = require('gulp-istanbul');
const mocha = require('gulp-mocha');
const nodemon = require('gulp-nodemon');
const runSequence = require('run-sequence');
const replace = require('gulp-replace');
const shell = require('gulp-shell')
const remapIstanbul = require('remap-istanbul/lib/gulpRemapIstanbul');
const path = require('path');

if (typeof process.env.DOCURL == "undefined") {
  process.env.DOCURL = "https://matchmyroute-backend.appspot.com";
}

function getOption (name) {
  let i = process.argv.indexOf('--' + name)
  let result
  if (i > -1) {
    result = process.argv[i + 1]
  }
  return result
}

gulp.task("info", () => {
  return gulp.src('./conf/info.json')
    .pipe(populateWithEnvVariables())
    .pipe(gulp.dest('./build/static'));
});

gulp.task("copy-swagger", () => {
  return gulp.src('./node_modules/swagger-ui/dist/**/*')
    .pipe(gulp.dest('./build/static'))
});

gulp.task("swagger-ui", ["copy-swagger"], () => {
  return gulp.src('./node_modules/swagger-ui/dist/index.html')
    .pipe(replace('http://petstore.swagger.io/v2/swagger.json', process.env.DOCURL + '/swagger.json'))
    .pipe(gulp.dest('./build/static'))
});

function populateWithEnvVariables() {
  let variables = ["CIRCLE_BUILD_NUM"];

  function transform(file, cb) {
    // read and modify file contents
    let conf = JSON.parse(file.contents);


    for (let varIndex in variables) {
      let varName = variables[varIndex];
      conf[varName] = process.env[varName];
    }

    file.contents = new Buffer(JSON.stringify(conf, null, ' '));

    // if there was some error, just pass as the first parameter here
    cb(null, file);
  }

  return require('event-stream').map(transform);
}

gulp.task("default", ["build"]);

function getBaseEnvVars() {
    return {
        PROCESS_TYPE: "web",
        WITH_SERVICES: true,
        NODE_PATH: ".",
        PGDATABASE: "matchMyRoute",
        STORAGE_BASE_URL: "https://storage.googleapis.com"
    };
};

function getDevelopmentEnvVars() {
    return Object.assign(getBaseEnvVars(),
    {
        DB_CONNECTION_PATH: "localhost",
        PGPORT: 5432,
        DOCURL: "http://localhost:8080",
        STATIC_DIR: "build/static",
        NODE_ENV: "development",
        GOOGLE_APPLICATION_CREDENTIALS: "conf/storage-keyfile.json",
        STORAGE_BUCKET: "matchmyroute-dev",
    });
};

function getProductionEnvVars() {
    return Object.assign(getBaseEnvVars(),
    {
        DB_CONNECTION_PATH: "/cloudsql/matchmyroute-backend:us-east1:matchmyroute-database",
        PGPORT: 5432,
        DOCURL: "https://matchmyroute-backend.appspot.com",
        STATIC_DIR: "static",
        NODE_ENV: "production",
        PGUSER: "postgres",
        PGPASSWORD: "",
        GOOGLE_APPLICATION_CREDENTIALS: "conf/storage-keyfile.json",
        STORAGE_BUCKET: "matchmyroute-prod"
    });
};

function getStagingEnvVars() {
    return Object.assign(getBaseEnvVars(),
    {
        DB_CONNECTION_PATH: "127.0.0.1",
        PGPORT: 5432,
        NODE_ENV: "staging",
        PGUSER: "testuser",
        PGPASSWORD: "test",
        GOOGLE_APPLICATION_CREDENTIALS: "conf/storage-keyfile.json",
        STORAGE_BUCKET: "matchmyroute-prod"
    });
};

// Format an object of {key:value} as key: value with the given indentation
function formatYaml(obj, indentation) {
    const indent = Array((indentation||0)+1).join(' ');
    return Object.keys(obj).map(function(key) {
        return indent + key + ': ' + obj[key];
    }).join('\n')
}

gulp.task("set-env-vars", function() {
    switch(process.env.NODE_ENV) {
        case "development":
            env.set(getDevelopmentEnvVars());
            break;
        case "production":
            env.set(getProductionEnvVars());
            break;
        case "staging":
            env.set(getStagingEnvVars());
            break;
        default:
            env.set(getDevelopmentEnvVars());
            break;
    }
});

gulp.task("tslint", () => {
  return tsProject.src()
    .pipe(tslint({
        formatter: "verbose",
        configuration: "tslint.json",
    }))
    .pipe(tslint.report({
        emitError: process.argv[2] === 'serve' ? false: true,
    }))
});

gulp.task("typescript", () => {
  return tsProject.src()
    .pipe(sourcemaps.init())
    .pipe(tsProject()).js
      .pipe(sourcemaps.write())
      .pipe(gulp.dest(tsProject.options.outDir));
});

gulp.task("clean", () => {
  return gulp.src(["build","coverage"])
    .pipe(clean());
});

gulp.task("pre-test", ["typescript", "set-env-vars"], () => {
  return gulp.src(["build/**/*.js", "!build/_*", "!build/**/**[sS]pec.js", "!build/static/**/*.js",])
    .pipe(istanbul({includeUntested: true}))
    .pipe(istanbul.hookRequire());
});

gulp.task("unittest", ["pre-test"], () => {
  return gulp.src(["build/**/*[sS]pec.js"])
    .pipe(mocha({
      verbose: true,
      includeStackTrace: true,
      timeout: 5000,
      // debugBrk: true,
      // debug: true,
      // inspect: true
    }))
    .on('error', (err) => {
      console.log("error: ", err);
      if (process.argv[2] !== 'serve') {
        process.exit(1);
      }
    })
    .pipe(istanbul.writeReports({
      dir: "./coverage/unit",
      reporters: ["json"]
    }));
});

gulp.task("e2etest", ["pre-test"], () => {
  return gulp.src("build/**/*.e2e.js")
    .pipe(mocha({
      verbose: true,
      includeStackTrace: true,
      timeout: 20000
    }))
    .on('error', () => {
      if (process.argv[2] !== 'serve') {
        console.error('End to end tests failed');
        process.exit(1);
      }
    })
    .pipe(istanbul.writeReports({
      dir: "./coverage/e2e",
      reporters: ["json"]
    }));
});

gulp.task("test", ["build", "pre-test"], (cb) => {
  // runSequence(["remap-istanbul-unit", "tslint"], 'remap-istanbul-e2e', cb);
  runSequence(["remap-istanbul-unit", "tslint"], cb);
});

gulp.task("copy-conf", () => {
  gulp.src(['conf/*'])
    .pipe(gulp.dest('build/conf/'));
});

gulp.task("build", ["typescript", "swagger-ui", "info", "copy-conf", "set-env-vars"], () => {
  gulp.src('package.json')
    .pipe(gulp.dest('build'));
  gulp.src('conf/app.yaml')
    .pipe(replace('  GULP_INSERT: "HERE"', formatYaml(getProductionEnvVars(),2) ))
    .pipe(gulp.dest('build'));
});

gulp.task("serve", ["build"], () => {
  // configure nodemon
  nodemon({
    script: getOption('script'),
    ext: 'ts',
    tasks: ["test"],
  });
});

gulp.task('debug', ["build"], () => {
  // configure nodemon
  const envVars = {
    NODE_ENV: 'development',
    PROCESS_TYPE: 'web',
    WITH_SERVICES: getOption('with_services') || true
  }

  nodemon({
    exec: 'node --inspect-brk',
    ext: 'ts',
    script: getOption('script'),
    verbose: true,
    env: envVars
  }).on('start', ['']);
});

gulp.task('remap-istanbul-e2e', ["e2etest"], function () {
  return gulp.src('./coverage/e2e/coverage-final.json')
    .pipe(remapIstanbul({
      reports: {
        'html': "./coverage/e2e/html-report",
        "text": null,
        "json": "./coverage/e2e/coverage-remapped.json"
      }
    }))
    .pipe(gulp.dest('./coverage/e2e'));
});

gulp.task('remap-istanbul-unit', ["unittest"], function () {
  return gulp.src('./coverage/unit/coverage-final.json')
    .pipe(remapIstanbul({
      reports: {
        'html': "./coverage/unit/html-report",
        "text": null,
        "json": "./coverage/unit/coverage-remapped.json"
      }
    }))
    .pipe(gulp.dest('./coverage/unit'));
});

gulp.task("dredd", ["serve"], function () {
  // shell doesn't need the source piped to it but this way we can attach 'error' and 'end' events...
  return gulp.src('.')
    .pipe(shell([
      'sleep 10',
      'npm run dredd'
    ]))
    .once('error', (err) => {
      console.log('[gulp] error:', err)
      process.exit(1)
    })
    .once('end', () => {
      process.exit()
    })
})

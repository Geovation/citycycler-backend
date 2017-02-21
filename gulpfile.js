const gulp = require("gulp");
const ts = require("gulp-typescript");
const tsProject = ts.createProject("tsconfig.json");
const sourcemaps = require('gulp-sourcemaps');
const clean = require('gulp-clean');
const env = require("gulp-env");
const tslint = require("gulp-tslint");
const jsonfile = require('jsonfile');
const run = require('gulp-run');
const jasmine = require('gulp-jasmine');
const istanbul = require('gulp-istanbul');
const nodemon = require('gulp-nodemon');
const runSequence = require('run-sequence');
const replace = require('gulp-replace');
const shell = require('gulp-shell')
const remapIstanbul = require('remap-istanbul/lib/gulpRemapIstanbul');
const path = require('path');

if (typeof process.env.DOCURL == "undefined") {
  process.env.DOCURL = "https://timepix-dev.appspot.com";
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
    .pipe(replace('http://petstore.swagger.io/v2/swagger.json', process.env.DOCURL + '/swagger.yaml'))
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

gulp.task("pre-test", ["typescript"], () => {
  const envs = env.set({
    NODE_ENV: "development",
    PROCESS_TYPE: 'web',
    WITH_SERVICES: getOption('with_services') || true
  })
  return gulp.src(["build/**/*.js", "!build/_*", "!build/**/**[sS]pec.js", "!build/static/**/*.js",])
    .pipe(envs)
    .pipe(istanbul({includeUntested: true}))
    .pipe(istanbul.hookRequire());
});

gulp.task("unittest", ["pre-test"], () => {
  return gulp.src(["build/web/**/*[sS]pec.js", "!build/web/*[sS]pec.js"])
    .pipe(jasmine({
      verbose: true,
      includeStackTrace: true,
    }))
    .on('error', (err) => {
      console.log("error: ", err);
      if (process.argv[2] !== 'serve') {
        console.log("In unit-test");
        console.error('Unit tests failed');
        process.exit(1);
      }
    })
    .pipe(istanbul.writeReports({
      dir: "./coverage/unit",
      reporters: ["json"]
    }));
});

gulp.task("e2etest", ["pre-test"], () => {
  return gulp.src("build/web/*[sS]pec.js")
    .pipe(jasmine({
      verbose: true,
      includeStackTrace: true,
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
  runSequence(["remap-istanbul-unit", "tslint"], 'remap-istanbul-e2e', cb);
});

gulp.task("copy-conf", () => {
  gulp.src(['conf/*'])
    .pipe(gulp.dest('build/conf/'));
});

gulp.task("build", ["typescript", "swagger-ui", "info", "copy-conf"], () => {
  gulp.src(['conf/app.yaml', 'package.json'])
    .pipe(gulp.dest('build'));
});

gulp.task("serve", ["build"], () => {
  // configure nodemon
  const envVars = {
    NODE_ENV: 'development',
    PROCESS_TYPE: 'web',
    WITH_SERVICES: getOption('with_services') || true
  }

  nodemon({
    script: getOption('script'),
    ext: 'ts',
    tasks: ["test"],
    env: envVars,
  });
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

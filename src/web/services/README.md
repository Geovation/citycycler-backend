### to add a end point: /MYENDPOINT/MYMETHOD

- mkdir /src/web/services/MYENDPOINT
- cp /src/web/services/**images/get.ts** /src/web/services/**MYENDPOINT/MYMETHOD.ts** 
- edit /src/web/services/**MYENDPOINT/MYMETHOD.ts**
  - edit path constant with your swagger definition (endpoint is derived from folder name)
  - update end point with Senaca coordinates (Paul will explain better)
- cp /src/web/services/**images/index.ts** /src/web/services/**MYENDPOINT/**
  - edit /src/web/services/**MYENDPOINT/index.ts**
    - import the methods used
    - add the endpoints collection
- edit /src/web/services/**index.ts**
  - import **MYENDPOINT**
  - add MYENDPOINT to the enpoint collection.

### to add parameter to end point
- see /src/web/services/**images/getById.ts**
- edit the swagger definition in /src/web/services/**MYENDPOINT/MYMETHOD.ts**

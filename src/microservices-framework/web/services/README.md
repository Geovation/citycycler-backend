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

## A note on endpoints
All API endpoints (i.e. endpoints with a Swagger definition) are locally networked to the API (that is to say, they
reside in the same process as the API).  This is because Seneca-Web only passes the request as a parameter to local
Seneca actions (actions handled over transport receive a reduced set of data with the request and response objects
removed - see [here](https://github.com/senecajs/seneca-web/blob/ac286c70bbfce4706a3edfbb36b9c9fe4877f95c/README.md)).

Non-API endpoints (i.e. endpoints without a Swagger definition) are available to be hosted in a separate
process/separate machine if required. They are handled over tcp. This means that API endpoints should be as light-weight
as possible and should hand-off heavy processing tasks to non-API endpoints, as the non-API endpoints can be run on a
different host. This, in turn, means that they can be load-balanced, started and stopped according to demand, scaled-up
on the fly etc. in a manner that doesn't affect the API.
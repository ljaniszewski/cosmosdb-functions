const crypto = require('crypto');
const fileSystem = require('fs');
const https = require('https');

let ENVIRONMENT; // DEV, STG, PROD

let DATABASE_PRIMARY_KEY;
let COLLECTION_RESOURCE_ID;
let HOSTNAME;

const COSMOSDB_API_VERSION = '2017-02-22';
const PROCEDURES_PATH = './dist/procedures';
const TRIGGERS_PATH = './dist/triggers';

const DATE = new Date().toUTCString();

try {
  APP_NAME = process.argv[2];
  ENVIRONMENT = process.argv[3];
  DATABASE_PRIMARY_KEY = process.env[`${ENVIRONMENT}_DATABASE_PRIMARY_KEY`];
  COLLECTION_RESOURCE_ID = process.env[`${ENVIRONMENT}_COLLECTION_RESOURCE_ID`];
  HOSTNAME = process.env[`${ENVIRONMENT}_HOSTNAME`];

  synchronizeProcedures()
    .then(console.log)
    .catch(error => {
        ci_job_fail_with_error(error);
      }
    );

  synchronizeTriggers()
    .then(console.log)
    .catch(error => {
        console.log(error);
        ci_job_fail_with_error(error);
      }
    );

} catch (error) {
  console.log(`
    Usage example:
    node synchronizeWithCosmosDB DEV
  `);
  ci_job_fail_with_error(error);
}


//region Stored procedures
async function synchronizeProcedures() {
  const allProcedures = fileSystem.readdirSync(PROCEDURES_PATH);
  return Promise.all(allProcedures.map(tryPutProcedure));
}

async function tryPutProcedure(procedureFileName) {
  const procedure = fileSystem.readFileSync(`${PROCEDURES_PATH}/${procedureFileName}`, 'utf8');
  const requestBody = {
    body: procedure,
    id: procedureFileName.replace('.js', '')
  };

  const authTokenPUT = getAuthorizationToken(
    'PUT',
    `${COLLECTION_RESOURCE_ID}/sprocs/${requestBody.id}`,
    'sprocs',
    DATE,
    DATABASE_PRIMARY_KEY
  );

  const procedurePutOptions = {
    hostname: HOSTNAME,
    path: `/${COLLECTION_RESOURCE_ID}/sprocs/${requestBody.id}`,
    method: 'PUT',
    headers: {
      'x-ms-version': COSMOSDB_API_VERSION,
      'Content-Type': 'application/json',
      'Authorization': authTokenPUT,
      'x-ms-date': DATE
    }
  };

  let response = await makeRequest(procedurePutOptions, requestBody);

  if (response.code === 'NotFound') {
    response = await postProcedure(requestBody);
  }

  return response;
}

async function postProcedure(requestBody) {
  const authTokenPOST = getAuthorizationToken(
    'POST',
    COLLECTION_RESOURCE_ID,
    'sprocs',
    DATE,
    DATABASE_PRIMARY_KEY
  );

  const procedurePostOptions = {
    hostname: HOSTNAME,
    path: `/${COLLECTION_RESOURCE_ID}/sprocs`,
    method: 'POST',
    headers: {
      'x-ms-version': COSMOSDB_API_VERSION,
      'Content-Type': 'application/json',
      'Authorization': authTokenPOST,
      'x-ms-date': DATE
    }
  };

  return makeRequest(procedurePostOptions, requestBody);
}
//endregion

//region Triggers
async function synchronizeTriggers() {
  const allTriggers = fileSystem.readdirSync(TRIGGERS_PATH);
  return Promise.all(allTriggers.map(tryPutTrigger));
}

async function tryPutTrigger(triggerFileName) {
  const trigger = fileSystem.readFileSync(`${TRIGGERS_PATH}/${triggerFileName}`, 'utf8');
  const triggerInfo = triggerFileName.split('-');
  const requestBody = {
    body: trigger,
    id: triggerInfo[0],
    triggerType: triggerInfo[1],
    triggerOperation: triggerInfo[2].replace('.js', '')
  };

  const authTokenPUT = getAuthorizationToken(
    'PUT',
    `${COLLECTION_RESOURCE_ID}/triggers/${requestBody.id}`,
    'triggers',
    DATE,
    DATABASE_PRIMARY_KEY
  );

  const triggerPutOptions = {
    hostname: HOSTNAME,
    path: `/${COLLECTION_RESOURCE_ID}/triggers/${requestBody.id}`,
    method: 'PUT',
    headers: {
      'x-ms-version': COSMOSDB_API_VERSION,
      'Content-Type': 'application/json',
      'Authorization': authTokenPUT,
      'x-ms-date': DATE
    }
  };

  let response = await makeRequest(triggerPutOptions, requestBody);

  if (response.code === 'NotFound') {
    response = await postTrigger(requestBody);
  }

  return response;
}

async function postTrigger(requestBody) {
  const authTokenPOST = getAuthorizationToken(
    'POST',
    COLLECTION_RESOURCE_ID,
    'triggers',
    DATE,
    DATABASE_PRIMARY_KEY
  );

  const triggerPostOptions = {
    hostname: HOSTNAME,
    path: `/${COLLECTION_RESOURCE_ID}/triggers`,
    method: 'POST',
    headers: {
      'x-ms-version': COSMOSDB_API_VERSION,
      'Content-Type': 'application/json',
      'Authorization': authTokenPOST,
      'x-ms-date': DATE
    }
  };

  return makeRequest(triggerPostOptions, requestBody);
}
//endregion

async function makeRequest(requestOptions, requestBody) {
  return new Promise((resolve, reject) => {
    const request = https.request(requestOptions, (response) => {
      const chunks = [];
      response.on('data', data => {
        chunks.push(data);
      });
      response.on('end', () => {
        let responseBody = Buffer.concat(chunks);
        responseBody = JSON.parse(responseBody);
        resolve(responseBody);
      });
    });
    request.on('error', (error) => {
      reject(error);
    });
    request.write(JSON.stringify(requestBody));
    request.end();
  });
}

function getAuthorizationToken(httpMethod, resourcePath, resourceType, date, databasePrimaryKey) {
  const params = `${httpMethod.toLowerCase()}\n${resourceType.toLowerCase()}\n${resourcePath}\n${date.toLowerCase()}\n\n`;

  const key = Buffer.from(databasePrimaryKey, 'base64');
  const body = Buffer.from(params, 'utf8');
  const signature = crypto.createHmac('sha256', key).update(body).digest('base64');

  return encodeURIComponent(`type=master&ver=1.0&sig=${signature}`);
}

function ci_job_fail_with_error(error) {
  console.log(error.message);
  process.exit(1);
}

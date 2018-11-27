
async function getSomething(arrayOfIds) {

  const startTime = new Date(); // measure execution time
  const queryOptions = {pageSize: -1};

  async function getSomethingById(id) {
    const result = await doQuery(`SELECT FROM c WHERE c.id = "${id}" AND c.type = "GOOD_TYPE"`);
    return { id, result };
  }

  async function doQuery(query) {
    return new Promise((resolve, reject) => {
      __.queryDocuments(__.getSelfLink(), query, queryOptions, (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
  }

  try {
    arrayOfIds = JSON.parse(arrayOfIds);

    let promises = arrayOfIds.map(getSomethingById);
    let results = await Promise.all(promises);

    getContext().getResponse().setBody(JSON.stringify(results));
    console.log(`time=${(new Date() - startTime)}ms`);
  } catch (error) {
    getContext().getResponse().setBody(error.message);
    console.log(error);
  }

}
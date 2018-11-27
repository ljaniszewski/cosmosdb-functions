async function deleteSomething() {
  const queryOptions = { pageSize: -1 };

  try {
    const something = getContext().getResponse().getBody();
    const param = 'paramvalue';
    const result = await doQuery(`SELECT * FROM c WHERE c.projectId = "${something.projectId}" AND STARTSWITH(c.somethingElse, "${param}")`);

    const promises = result.map(deleteDocument);
    await Promise.all(promises);

  } catch (error) {
    console.log(error);
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

  async function deleteDocument(document) {
    return new Promise((resolve, reject) => {
      __.deleteDocument(document._self, {}, (err, resultOptions) => {
        if (err) {
          reject(err);
        } else {
          resolve(resultOptions);
        }
      });
    });
  }

}
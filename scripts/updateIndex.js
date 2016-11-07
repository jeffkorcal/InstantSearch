// This script will update data in your index without replacing pre-existing content

var algoliasearch = require('algoliasearch');
var data = require('../resources/dataset/restaurants_list.json');

var client = algoliasearch(process.env.APPLICATION_ID, process.env.ADMIN_API_KEY);
var index = client.initIndex('Place2Eat');

function partialUpdate (arr) {

  arr.forEach(function updateEach(obj) {
    
    index.partialUpdateObject(obj)
    .then(function updateSuccess(content) {
      console.log(content);
    })
    .catch(function updateFailure(err) {
      console.error(err);
    });

  })
}

partialUpdate(data);
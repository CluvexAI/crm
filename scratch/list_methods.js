const postmark = require('postmark');
const client = new postmark.ServerClient('7f34db3b-5094-4a8f-a162-16888266d45b');

const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(client))
  .filter(p => typeof client[p] === 'function');

console.log("Client Prototype Methods:");
console.log(methods);

console.log("\nClient Own Methods:");
console.log(Object.getOwnPropertyNames(client).filter(p => typeof client[p] === 'function'));

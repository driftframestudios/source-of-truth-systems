import { exampleData } from '../build/server/example-data.mjs';
import { createReadApi } from '../server/graphql/api.mjs';

const { operations } = createReadApi({ data: exampleData });
console.log(JSON.stringify(operations, null, 2));

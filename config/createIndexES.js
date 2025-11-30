const client = require("./elasticsearch");

async function createIndexES() {
  const indexName = "products";

  const exists = await client.indices.exists({ index: indexName });
  if (exists) {
    console.log(`Index "${indexName}" đã tồn tại`);
    return;
  }

  await client.indices.create({
    index: indexName,
    body: {
      mappings: {
        properties: {
          brandId: { type: "keyword" },
          categoryId: { type: "keyword" },
          name: {
            type: "text",
            fields: {
              keyword: {
                type: "keyword",
                ignore_above: 256,
              },
            },
          },
          price: { type: "float" },
          description: { type: "text" },
          defaultImage: { type: "keyword" },
          defaultImagePublicId: { type: "keyword" },
          suggest: { type: "completion" }, // để autocomplete
        },
      },
    },
  });

  console.log(`Index "${indexName}" đã được tạo với mapping chuẩn`);
}

module.exports = createIndexES;

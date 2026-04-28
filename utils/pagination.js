module.exports = async function paginate(Model, query = {}, options = {}) {
  let { page, limit, sort } = options;

  page = parseInt(page) || 1;
  limit = parseInt(limit) || 10;
  sort = sort || { createdAt: -1 };

  const skip = (page - 1) * limit;

  // Count total documents
  const total = await Model.countDocuments(query);

  // Fetch paginated data
  const data = await Model.find(query).skip(skip).limit(limit).sort(sort);

  return {
    success: true,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    data,
  };
};

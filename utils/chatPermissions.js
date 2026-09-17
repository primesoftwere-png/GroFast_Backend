const allowedChatPairs = [
  ['user', 'admin'],           // Customer <-> Shopkeeper
  ['user', 'deliveryBoy'],     // Customer <-> Delivery Boy
  ['admin', 'deliveryBoy'],    // Shopkeeper <-> Delivery Boy
  ['admin', 'superadmin'],     // Shopkeeper <-> Admin
  ['deliveryBoy', 'superadmin'],// Delivery Boy <-> Admin
  ['superadmin', 'superadmin'] // Admin <-> Admin
];

const canChat = (role1, role2) => {
  return allowedChatPairs.some(
    pair => (pair[0] === role1 && pair[1] === role2) || (pair[0] === role2 && pair[1] === role1)
  );
};

module.exports = {
  canChat
};

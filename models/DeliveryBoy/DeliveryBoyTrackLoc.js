// const client = require("../../Redis/server");

// const DeliveryBoyTrackLoc = (deliveryBoyId) => {
//   if (navigator.geolocation) {
//     navigator.geolocation.watchPosition(
//       (position) => {
//         const lat = position.coords.latitude;
//         const lon = position.coords.longitude;
//         const coordinates = {
//           lat: lat,
//           lng: lon,
//         };
//         client.set(
//           `deliveryBoy:${deliveryBoyId}:location`,
//           JSON.stringify(coordinates),
//           "EX",
//           10
//         );
//       },
//       (error) => {
//         console.error("Error getting location: ", error);
//       },
//       {
//         enableHighAccuracy: true,
//         maximumAge: 0,
//         timeout: 5000,
//       }
//     );
//   }
// };
// module.exports = DeliveryBoyTrackLoc;
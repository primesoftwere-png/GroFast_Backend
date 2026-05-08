/**
 * Route Verification Script
 * This script loads the router and verifies routes are registered
 * 
 * Usage: node scripts/verify-routes.js
 */

const express = require('express');
const app = express();

// Load the order router
const orderRouter = require('../router/Customer/order.router.js');

// Mount the router
app.use('/api/order', orderRouter);

// Function to list all routes
function listRoutes(app) {
  const routes = [];
  
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Direct route
      const methods = Object.keys(middleware.route.methods).map(m => m.toUpperCase());
      routes.push({
        method: methods[0],
        path: middleware.route.path
      });
    } else if (middleware.name === 'router') {
      // Router middleware
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods).map(m => m.toUpperCase());
          const basePath = middleware.regexp.source
            .replace('\\/?(?=\\/|$)', '')
            .replace(/\\\//g, '/')
            .replace('^', '')
            .replace('$', '');
          
          routes.push({
            method: methods[0],
            path: basePath + handler.route.path
          });
        }
      });
    }
  });
  
  return routes;
}

// Colors for console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m'
};

console.log('\n' + '='.repeat(60));
console.log(colors.cyan + '         ROUTE VERIFICATION SCRIPT' + colors.reset);
console.log('='.repeat(60) + '\n');

try {
  const routes = listRoutes(app);
  
  console.log(colors.green + '✅ Order router loaded successfully!' + colors.reset);
  console.log('\n' + colors.cyan + 'Registered Routes:' + colors.reset);
  console.log('─'.repeat(60));
  
  routes.forEach(route => {
    const methodColor = route.method === 'POST' ? colors.green : colors.yellow;
    console.log(`${methodColor}${route.method.padEnd(6)}${colors.reset} ${route.path}`);
  });
  
  console.log('─'.repeat(60));
  
  // Check for our specific route
  const convertCartRoute = routes.find(r => 
    r.path.includes('convert-cart-to-order') && r.method === 'POST'
  );
  
  if (convertCartRoute) {
    console.log('\n' + colors.green + '✅ /convert-cart-to-order route is registered!' + colors.reset);
    console.log(colors.green + '✅ Full path: POST ' + convertCartRoute.path + colors.reset);
  } else {
    console.log('\n' + colors.yellow + '⚠️  /convert-cart-to-order route NOT found!' + colors.reset);
    console.log(colors.yellow + '   This might indicate a problem with route registration.' + colors.reset);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(colors.cyan + 'Next Steps:' + colors.reset);
  console.log('1. If routes are listed above, restart your server');
  console.log('2. Test the endpoint: POST http://localhost:8000/api/order/convert-cart-to-order');
  console.log('3. If still getting 404, check server logs for errors');
  console.log('='.repeat(60) + '\n');
  
} catch (error) {
  console.error(colors.yellow + '❌ Error loading router:' + colors.reset);
  console.error(error.message);
  console.error('\nStack trace:');
  console.error(error.stack);
  
  console.log('\n' + colors.yellow + 'Possible issues:' + colors.reset);
  console.log('1. Missing dependencies - run: npm install');
  console.log('2. Syntax error in router file');
  console.log('3. Missing controller functions');
  console.log('4. Missing middleware files');
}

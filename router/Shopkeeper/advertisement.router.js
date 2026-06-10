const express = require('express');
const router = express.Router();
const advertisementController = require('../../controllers/Shopkeeper/advertisement.controller');
const upload = require('../../middlewere/uploadMiddleware');
const authMiddleware = require('../../middlewere/user.middlewere');

// Apply authentication middleware
router.use(authMiddleware.userMiddlewere);

router.post('/create', upload.single('image'), advertisementController.createAd);
router.get('/list', advertisementController.getAds);
router.get('/:id', advertisementController.getAdById);
router.put('/:id', upload.single('image'), advertisementController.updateAd);
router.delete('/:id', advertisementController.deleteAd);

module.exports = router;

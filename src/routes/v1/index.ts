import express from 'express';
import authRoute from './auth.route';
import userRoute from './user.route';
import docsRoute from './docs.route';
import uploadRoute from './upload.route';
import config from '../../config/config';
import dishRoute from './dish.route';
import iotRoute from './iot.route';

const router = express.Router();

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute
  },
  {
    path: '/users',
    route: userRoute
  },
  {
    path: '/uploads',
    route: uploadRoute
  },
  {
    path: '/dishes',
    route: dishRoute
  },
  {
    path: '/iot',
    route: iotRoute
  }
];

const devRoutes = [
  {
    path: '/docs',
    route: docsRoute
  }
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

/* istanbul ignore next */
if (config.env === 'development') {
  devRoutes.forEach((route) => {
    router.use(route.path, route.route);
  });
}

export default router;

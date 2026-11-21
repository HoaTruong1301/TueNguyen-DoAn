import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";

import {
  getMyProfile,
  updateMyProfile,
  getMyAddresses,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
} from "./members.controller";

const router = Router();

router.get(
  "/me",
  requireAuth,
  getMyProfile
);

router.put(
  "/me",
  requireAuth,
  updateMyProfile
);

router.get(
  "/addresses",
  requireAuth,
  getMyAddresses
);

router.post(
  "/addresses",
  requireAuth,
  createAddress
);

router.put(
  "/addresses/:id",
  requireAuth,
  updateAddress
);

router.put(
  "/addresses/:id/default",
  requireAuth,
  setDefaultAddress
);

router.delete(
  "/addresses/:id",
  requireAuth,
  deleteAddress
);

export default router;

import { Router } from "express";

import {
  getCategories,
  getFoods,
  getFoodById,
  getFeaturedFoods,
  getBanners,
} from "./menu.controller";



const router = Router();

router.get("/categories", getCategories);
router.get("/foods", getFoods);
router.get("/featured", getFeaturedFoods);
router.get("/foods/:id", getFoodById);
router.get("/banners", getBanners);

export default router;

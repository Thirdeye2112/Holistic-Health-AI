import { Router, type IRouter } from "express";
import healthRouter from "./health";
import medlensRouter from "./medlens";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(medlensRouter);
router.use(stripeRouter);

export default router;

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import conversationsRouter from "./conversations";
import messagesRouter from "./messages";
import profileRouter from "./profile";
import inviteRouter from "./invite";
import adminRouter from "./admin";
import uploadRouter from "./upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(conversationsRouter);
router.use(messagesRouter);
router.use(profileRouter);
router.use(inviteRouter);
router.use(adminRouter);
router.use(uploadRouter);

export default router;

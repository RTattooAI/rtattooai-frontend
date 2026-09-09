import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideLucideIcons,
  LucideLayoutGrid, LucideScanSearch, LucideHistory, LucideBookMarked, LucideUsers,
  LucideFileLock2, LucideShieldAlert, LucideLogOut, LucideX, LucideMenu,
  LucideChevronRight, LucideChevronLeft, LucideSearch, LucideBell, LucideHelpCircle,
  LucidePlus, LucideMail, LucideLock, LucideEye, LucideEyeOff,
  LucideLoader, LucideArrowRight, LucideArrowLeft, LucideFingerprint, LucideTriangleAlert,
  LucideImagePlus, LucideHand, LucideCrop, LucideRotateCw, LucideRotateCcw,
  LucideSparkles, LucideSquareDashed, LucideUndo2, LucideRedo2, LucideImage,
  LucideZoomOut, LucideZoomIn, LucideMaximize2, LucideCheckCircle2, LucideInfo,
  LucideClock, LucideCpu, LucideMapPin, LucideHash, LucideSave,
  LucideShare2, LucideFileDown, LucideDownload, LucideUserCheck, LucideThumbsUp,
  LucideThumbsDown, LucideListChecks, LucideTag, LucideGitCompare, LucideFlag,
  LucideCalendar, LucideFilter, LucideFileText, LucideMoreVertical, LucideDatabase,
  LucideTags, LucidePlusCircle, LucidePencil, LucidePower,
  LucideRefreshCw, LucideUser, LucideCheck, LucideClipboardCheck, LucideShieldCheck, LucideKeyRound,
  LucideCamera, LucideSwitchCamera, LucideRadio, LucideZap, LucideTrash2,
  LucideSun, LucideContrast, LucideSlidersHorizontal, LucideChevronDown, LucideBoxes, LucideScissors
} from '@lucide/angular';

import { routes } from './app.routes';
import { jwtInterceptor } from './core/auth';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    provideLucideIcons(
      LucideLayoutGrid, LucideScanSearch, LucideHistory, LucideBookMarked, LucideUsers,
      LucideFileLock2, LucideShieldAlert, LucideLogOut, LucideX, LucideMenu,
      LucideChevronRight, LucideChevronLeft, LucideSearch, LucideBell, LucideHelpCircle,
      LucidePlus, LucideMail, LucideLock, LucideEye, LucideEyeOff,
      LucideLoader, LucideArrowRight, LucideArrowLeft, LucideFingerprint, LucideTriangleAlert,
      LucideImagePlus, LucideHand, LucideCrop, LucideRotateCw, LucideRotateCcw,
      LucideSparkles, LucideSquareDashed, LucideUndo2, LucideRedo2, LucideImage,
      LucideZoomOut, LucideZoomIn, LucideMaximize2, LucideCheckCircle2, LucideInfo,
      LucideClock, LucideCpu, LucideMapPin, LucideHash, LucideSave,
      LucideShare2, LucideFileDown, LucideDownload, LucideUserCheck, LucideThumbsUp,
      LucideThumbsDown, LucideListChecks, LucideTag, LucideGitCompare, LucideFlag,
      LucideCalendar, LucideFilter, LucideFileText, LucideMoreVertical, LucideDatabase,
      LucideTags, LucidePlusCircle, LucidePencil, LucidePower,
      LucideRefreshCw, LucideUser, LucideCheck, LucideClipboardCheck, LucideShieldCheck, LucideKeyRound,
      LucideCamera, LucideSwitchCamera, LucideRadio, LucideZap, LucideTrash2,
  LucideSun, LucideContrast, LucideSlidersHorizontal, LucideChevronDown, LucideBoxes, LucideScissors
    )
  ]
};

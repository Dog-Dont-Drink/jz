import { createRouter, createWebHistory } from 'vue-router'
import WelcomePage from '../pages/WelcomePage.vue'
import LoginPage from '../pages/LoginPage.vue'
import RegisterPage from '../pages/RegisterPage.vue'
import QuestionListPage from '../pages/QuestionListPage.vue'
import QuestionDetailPage from '../pages/QuestionDetailPage.vue'
import UploadAnswerPage from '../pages/UploadAnswerPage.vue'
import OCRConfirmPage from '../pages/OCRConfirmPage.vue'
import GradeResultPage from '../pages/GradeResultPage.vue'
import HistoryPage from '../pages/HistoryPage.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'welcome', component: WelcomePage },
    { path: '/login', name: 'login', component: LoginPage },
    { path: '/register', name: 'register', component: RegisterPage },
    { path: '/questions', name: 'questions', component: QuestionListPage, meta: { requiresAuth: true } },
    { path: '/questions/:id', name: 'question-detail', component: QuestionDetailPage, meta: { requiresAuth: true } },
    { path: '/upload/:questionId', name: 'upload', component: UploadAnswerPage, meta: { requiresAuth: true } },
    { path: '/ocr-confirm/:submissionId', name: 'ocr-confirm', component: OCRConfirmPage, meta: { requiresAuth: true } },
    { path: '/result/:submissionId', name: 'grade-result', component: GradeResultPage, meta: { requiresAuth: true } },
    { path: '/history', name: 'history', component: HistoryPage, meta: { requiresAuth: true } },
    { path: '/:pathMatch(.*)*', redirect: { name: 'welcome' } },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.isInitialized) {
    await auth.initialize()
  }
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})

export default router


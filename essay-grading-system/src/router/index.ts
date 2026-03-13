import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'welcome',
      component: () => import('../pages/WelcomePage.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../pages/LoginPage.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../pages/RegisterPage.vue'),
    },
    {
      path: '/questions',
      name: 'questions',
      component: () => import('../pages/QuestionListPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/questions/:id',
      name: 'question-detail',
      component: () => import('../pages/QuestionDetailPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/upload/:questionId',
      name: 'upload',
      component: () => import('../pages/UploadAnswerPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/ocr-confirm/:submissionId',
      name: 'ocr-confirm',
      component: () => import('../pages/OCRConfirmPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/grade-result/:submissionId',
      name: 'grade-result',
      component: () => import('../pages/GradeResultPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('../pages/HistoryPage.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  // Wait for auth to initialize if it's still loading
  if (authStore.loading) {
    try {
      await authStore.initialize()
    } catch (error) {
      console.error('Auth initialization failed in router guard:', error)
    }
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } })
  } else if ((to.name === 'login' || to.name === 'register') && authStore.isAuthenticated) {
    next({ name: 'questions' })
  } else {
    next()
  }
})

export default router

import axios from 'axios'

const axiosClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
})

let refreshing = null

axiosClient.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err)
    }
    original._retry = true

    // Deduplicate concurrent refresh calls
    if (!refreshing) {
      refreshing = axios.post('/api/v1/auth/refresh', {}, { withCredentials: true })
        .finally(() => { refreshing = null })
    }

    try {
      await refreshing
      return axiosClient(original)
    } catch {
      return Promise.reject(err)
    }
  }
)

export default axiosClient

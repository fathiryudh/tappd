import { useReducer, useEffect } from 'react'
import axiosClient from '../api/axiosClient'
import { AuthContext } from './auth-context'

const initialState = { user: null, loading: true }

function reducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload, loading: false }
    case 'CLEAR_USER':
      return { ...state, user: null, loading: false }
    default:
      return state
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    axiosClient.post('/auth/refresh')
      .then(res => dispatch({ type: 'SET_USER', payload: res.data }))
      .catch(() => dispatch({ type: 'CLEAR_USER' }))
  }, [])

  const login = async (email, password) => {
    const { data } = await axiosClient.post('/auth/login', { email, password })
    dispatch({ type: 'SET_USER', payload: data })
  }

  const register = async (email, password) => {
    const { data } = await axiosClient.post('/auth/register', { email, password })
    dispatch({ type: 'SET_USER', payload: data })
  }

  const logout = async () => {
    await axiosClient.post('/auth/logout')
    dispatch({ type: 'CLEAR_USER' })
  }

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

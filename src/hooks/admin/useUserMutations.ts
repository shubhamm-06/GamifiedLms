import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createUser,
  updateUserEmail,
  updateUserPassword,
  type UserRole,
} from '@/lib/adminUserApi'
import { supabase } from '@/lib/supabase'
import { usersQueryKey } from './useUsers'

function useUsersInvalidator() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: usersQueryKey })
}

export function useCreateUser() {
  const invalidate = useUsersInvalidator()
  return useMutation({
    mutationFn: createUser,
    onSuccess: (_result, variables) => {
      invalidate()
      toast.success(`${variables.display_name} was added.`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

/**
 * display_name and role go straight through supabase-js rather than the
 * Edge Function — they're ordinary column writes already permitted by
 * the profiles_admin_update RLS policy (migration 004), with the role
 * change additionally gated by fn_prevent_role_change. Nothing here
 * needs service_role, so there's no reason to pay for a function hop.
 */
export function useUpdateProfile() {
  const invalidate = useUsersInvalidator()
  return useMutation({
    mutationFn: async ({
      userId,
      displayName,
      role,
    }: {
      userId: string
      displayName: string
      role: UserRole
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName, role })
        .eq('id', userId)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Profile updated.')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useUpdateEmail() {
  const invalidate = useUsersInvalidator()
  return useMutation({
    mutationFn: ({ userId, newEmail }: { userId: string; newEmail: string }) =>
      updateUserEmail(userId, newEmail),
    onSuccess: () => {
      invalidate()
      toast.success('Email address updated.')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      updateUserPassword(userId, newPassword),
    // No list invalidation — passwords aren't part of the table data.
    onSuccess: () => toast.success('Password changed. Tell the user directly.'),
    onError: (error: Error) => toast.error(error.message),
  })
}

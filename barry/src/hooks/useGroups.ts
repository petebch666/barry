import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { CreateGroupSchema, type Group, type CreateGroup } from '@/schemas';
import { z } from 'zod';

const InviteCodeSchema = z.string().length(8);

const QUERY_KEY = 'groups';

export function useGroups() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select(`
          *,
          group_members!inner(user_id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Group[];
    },
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (error) throw error;
      return data as Group;
    },
    enabled: !!groupId,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateGroup) => {
      CreateGroupSchema.parse(input);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate a short unique invite code server-side
      const inviteCode = Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
        .slice(0, 8);

      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({ ...input, created_by: user.id, invite_code: inviteCode })
        .select()
        .single();

      if (groupError) throw groupError;

      // Creator is automatically the admin
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: user.id, role: 'admin' });

      if (memberError) throw memberError;

      return group as Group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, groupId, 'members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          *,
          profiles(id, display_name, avatar_url)
        `)
        .eq('group_id', groupId)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });
}

export function useUpdateMemberRole(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'admin' | 'member' }) => {
      const { error } = await supabase
        .from('group_members')
        .update({ role })
        .eq('group_id', groupId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, groupId, 'members'] });
    },
  });
}

export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, groupId, 'members'] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useGroupByInviteCode(code: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'invite', code],
    queryFn: async () => {
      if (!code || code.length !== 8) return null;
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, description')
        .eq('invite_code', code.toUpperCase())
        .single();
      if (error) return null;
      return data as Pick<Group, 'id' | 'name' | 'description'>;
    },
    enabled: !!code && code.length === 8,
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteCode: string) => {
      InviteCodeSchema.parse(inviteCode.toUpperCase());

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id, name')
        .eq('invite_code', inviteCode.toUpperCase())
        .single();

      if (groupError || !group) throw new Error('Invalid invite code');

      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: user.id, role: 'member' });

      if (memberError && memberError.code !== '23505') throw memberError;

      return group as Pick<Group, 'id' | 'name'>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useInviteLink(groupId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, groupId, 'invite'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('invite_code')
        .eq('id', groupId)
        .single();

      if (error) throw error;
      return `barry://join/${data.invite_code}`;
    },
    enabled: !!groupId,
  });
}

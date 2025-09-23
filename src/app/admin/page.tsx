/* eslint-disable @typescript-eslint/no-explicit-any, no-console, @typescript-eslint/no-non-null-assertion,react-hooks/exhaustive-deps,@typescript-eslint/no-empty-function */

'use client';

import {
  closestCenter,
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  FileText,
  FolderOpen,
  KeyRound,
  Settings,
  Tv,
  UserCheck,
  Users,
  Video,
  Upload,
  FileJson,
  Sheet,
} from 'lucide-react';
import { GripVertical } from 'lucide-react';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  AdminConfig,
  AdminConfigResult,
  PendingUser,
  RegistrationStats,
  SiteConfig,
} from '@/lib/admin.types';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { parseImportData, exportData } from '@/lib/utils';

import DataMigration from '@/components/DataMigration';
import PageLayout from '@/components/PageLayout';

// 统一按钮样式系统
const buttonStyles = {
  // 主要操作按钮（蓝色）- 用于配置、设置、确认等
  primary:
    'px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg transition-colors',
  // 成功操作按钮（绿色）- 用于添加、启用、保存等
  success:
    'px-3 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white rounded-lg transition-colors',
  // 危险操作按钮（红色）- 用于删除、禁用、重置等
  danger:
    'px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-lg transition-colors',
  // 次要操作按钮（灰色）- 用于取消、关闭等
  secondary:
    'px-3 py-1.5 text-sm font-medium bg-gray-600 hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-700 text-white rounded-lg transition-colors',
  // 警告操作按钮（黄色）- 用于批量禁用等
  warning:
    'px-3 py-1.5 text-sm font-medium bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-600 dark:hover:bg-yellow-700 text-white rounded-lg transition-colors',
  // 小尺寸主要按钮
  primarySmall:
    'px-2 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-md transition-colors',
  // 小尺寸成功按钮
  successSmall:
    'px-2 py-1 text-xs font-medium bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white rounded-md transition-colors',
  // 小尺寸危险按钮
  dangerSmall:
    'px-2 py-1 text-xs font-medium bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-md transition-colors',
  // 小尺寸次要按钮
  secondarySmall:
    'px-2 py-1 text-xs font-medium bg-gray-600 hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-700 text-white rounded-md transition-colors',
  // 小尺寸警告按钮
  warningSmall:
    'px-2 py-1 text-xs font-medium bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-600 dark:hover:bg-yellow-700 text-white rounded-md transition-colors',
  // 圆角小按钮（用于表格操作）
  roundedPrimary:
    'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 dark:text-blue-200 transition-colors',
  roundedSuccess:
    'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/40 dark:hover:bg-green-900/60 dark:text-green-200 transition-colors',
  roundedDanger:
    'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 dark:text-red-200 transition-colors',
  roundedSecondary:
    'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700/40 dark:hover:bg-gray-700/60 dark:text-gray-200 transition-colors',
  roundedWarning:
    'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/40 dark:hover:bg-yellow-900/60 dark:text-yellow-200 transition-colors',
  roundedPurple:
    'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 dark:text-purple-200 transition-colors',
  // 禁用状态
  disabled:
    'px-3 py-1.5 text-sm font-medium bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white rounded-lg transition-colors',
  disabledSmall:
    'px-2 py-1 text-xs font-medium bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white rounded-md transition-colors',
  // 开关按钮样式
  toggleOn: 'bg-green-600 dark:bg-green-600',
  toggleOff: 'bg-gray-200 dark:bg-gray-700',
  toggleThumb: 'bg-white',
  toggleThumbOn: 'translate-x-6',
  toggleThumbOff: 'translate-x-1',
  // 快速操作按钮样式
  quickAction:
    'px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors',
};

// 通用弹窗组件
interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timer?: number;
  showConfirm?: boolean;
}

const AlertModal = ({
  isOpen,
  onClose,
  type,
  title,
  message,
  timer,
  showConfirm = false,
}: AlertModalProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      if (timer) {
        setTimeout(() => {
          onClose();
        }, timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [isOpen, timer, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className='w-8 h-8 text-green-500' />;
      case 'error':
        return <AlertCircle className='w-8 h-8 text-red-500' />;
      case 'warning':
        return <AlertTriangle className='w-8 h-8 text-yellow-500' />;
      case 'info':
        return <AlertCircle className='w-8 h-8 text-blue-500' />;
      default:
        return null;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';      
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full border ${getBgColor()} transition-all duration-200 ${
          isVisible ? 'scale-100' : 'scale-95'
        }`}
      >
        <div className='p-6 text-center'>
          <div className='flex justify-center mb-4'>{getIcon()}</div>

          <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2'>
            {title}
          </h3>

          {message && (
            <p className='text-gray-600 dark:text-gray-400 mb-4'>{message}</p>
          )}

          {showConfirm && (
            <button
              onClick={onClose}
              className={`px-4 py-2 text-sm font-medium ${buttonStyles.primary}`}
            >
              确定
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// 弹窗状态管理
const useAlertModal = () => {
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
    timer?: number;
    showConfirm?: boolean;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
  });

  const showAlert = (config: Omit<typeof alertModal, 'isOpen'>) => {
    setAlertModal({ ...config, isOpen: true });
  };

  const hideAlert = () => {
    setAlertModal((prev) => ({ ...prev, isOpen: false }));
  };

  return { alertModal, showAlert, hideAlert };
};

// 统一弹窗方法（必须在首次使用前定义）
const showError = (message: string, showAlert?: (config: any) => void) => {
  if (showAlert) {
    showAlert({ type: 'error', title: '错误', message, showConfirm: true });
  } else {
    console.error(message);
  }
};

const showSuccess = (message: string, showAlert?: (config: any) => void) => {
  if (showAlert) {
    showAlert({ type: 'success', title: '成功', message, timer: 2000 });
  } else {
    console.log(message);
  }
};

// 通用加载状态管理系统
interface LoadingState {
  [key: string]: boolean;
}

const useLoadingState = () => {
  const [loadingStates, setLoadingStates] = useState<LoadingState>({});

  const setLoading = (key: string, loading: boolean) => {
    setLoadingStates((prev) => ({ ...prev, [key]: loading }));
  };

  const isLoading = (key: string) => loadingStates[key] || false;

  const withLoading = async (
    key: string,
    operation: () => Promise<any>
  ): Promise<any> => {
    setLoading(key, true);
    try {
      const result = await operation();
      return result;
    } finally {
      setLoading(key, false);
    }
  };

  return { loadingStates, setLoading, isLoading, withLoading };
};




// 直播源数据类型
interface LiveDataSource {
  name: string;
  key: string;
  url: string;
  ua?: string;
  epg?: string;
  channelNumber?: number;
  disabled?: boolean;
  from: 'config' | 'custom';
}

// 自定义分类数据类型
interface CustomCategory {
  name?: string;
  type: 'movie' | 'tv';
  query: string;
  disabled?: boolean;
  from: 'config' | 'custom';
}

// 可折叠标签组件
interface CollapsibleTabProps {
  title: string;
  icon?: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleTab = ({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
}: CollapsibleTabProps) => {
  return (
    <div className='rounded-xl shadow-sm mb-4 overflow-hidden bg-white/80 backdrop-blur-md dark:bg-gray-800/50 dark:ring-1 dark:ring-gray-700'>
      <button
        onClick={onToggle}
        className='w-full px-6 py-4 flex items-center justify-between bg-gray-50/70 dark:bg-gray-800/60 hover:bg-gray-100/80 dark:hover:bg-gray-700/60 transition-colors'
      >
        <div className='flex items-center gap-3'>
          {icon}
          <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100'>
            {title}
          </h3>
        </div>
        <div className='text-gray-500 dark:text-gray-400'>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </button>

      {isExpanded && <div className='px-6 py-4'>{children}</div>}
    </div>
  );
};

// 用户配置组件
interface UserConfigProps {
  config: AdminConfig | null;
  role: 'owner' | 'admin' | null;
  refreshConfig: () => Promise<void>;
}

const UserConfig = ({ config, role, refreshConfig }: UserConfigProps) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [showAddUserGroupForm, setShowAddUserGroupForm] = useState(false);
  const [showEditUserGroupForm, setShowEditUserGroupForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    userGroup: '', // 新增用户组字段
  });
  const [changePasswordUser, setChangePasswordUser] = useState({
    username: '',
    password: '',
  });
  const [newUserGroup, setNewUserGroup] = useState({
    name: '',
    enabledApis: [] as string[],
  });
  const [editingUserGroup, setEditingUserGroup] = useState<{
    name: string;
    enabledApis: string[];
  } | null>(null);
  const [showConfigureApisModal, setShowConfigureApisModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    username: string;
    role: 'user' | 'admin' | 'owner';
    enabledApis?: string[];
    tags?: string[];
  } | null>(null);
  const [selectedApis, setSelectedApis] = useState<string[]>([]);
  const [showConfigureUserGroupModal, setShowConfigureUserGroupModal] =
    useState(false);
  const [selectedUserForGroup, setSelectedUserForGroup] = useState<{
    username: string;
    role: 'user' | 'admin' | 'owner';
    tags?: string[];
  } | null>(null);
  const [selectedUserGroups, setSelectedUserGroups] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showBatchUserGroupModal, setShowBatchUserGroupModal] = useState(false);
  const [selectedUserGroup, setSelectedUserGroup] = useState<string>('');
  const [showDeleteUserGroupModal, setShowDeleteUserGroupModal] =
    useState(false);
  const [deletingUserGroup, setDeletingUserGroup] = useState<{
    name: string;
    affectedUsers: Array<{
      username: string;
      role: 'user' | 'admin' | 'owner';
    }>;
  } | null>(null);
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);

  // 当前登录用户名
  const currentUsername = getAuthInfoFromBrowserCookie()?.username || null;

  // 使用 useMemo 计算全选状态，避免每次渲染都重新计算
  const selectAllUsers = useMemo(() => {
    const selectableUserCount =
      config?.UserConfig?.Users?.filter(
        (user) =>
          role === 'owner' ||
          (role === 'admin' &&
            (user.role === 'user' || user.username === currentUsername))
      ).length || 0;
    return selectedUsers.size === selectableUserCount && selectedUsers.size > 0;
  }, [selectedUsers.size, config?.UserConfig?.Users, role, currentUsername]);

  // 获取用户组列表
  const userGroups = config?.UserConfig?.Tags || [];

  // 处理用户组相关操作
  const handleUserGroupAction = async (
    action: 'add' | 'edit' | 'delete',
    groupName: string,
    enabledApis?: string[]
  ) => {
    return withLoading(`userGroup_${action}_${groupName}`, async () => {
      try {
        const res = await fetch('/api/admin/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'userGroup',
            groupAction: action,
            groupName,
            enabledApis,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `操作失败: ${res.status}`);
        }

        await refreshConfig();

        if (action === 'add') {
          setNewUserGroup({ name: '', enabledApis: [] });
          setShowAddUserGroupForm(false);
        } else if (action === 'edit') {
          setEditingUserGroup(null);
          setShowEditUserGroupForm(false);
        }

        showSuccess(
          action === 'add'
            ? '用户组添加成功'
            : action === 'edit'
            ? '用户组更新成功'
            : '用户组删除成功',
          showAlert
        );
      } catch (err) {
        showError(err instanceof Error ? err.message : '操作失败', showAlert);
        throw err;
      }
    });
  };

  const handleAddUserGroup = () => {
    if (!newUserGroup.name.trim()) return;
    handleUserGroupAction('add', newUserGroup.name, newUserGroup.enabledApis);
  };

  const handleEditUserGroup = () => {
    if (!editingUserGroup?.name.trim()) return;
    handleUserGroupAction(
      'edit',
      editingUserGroup.name,
      editingUserGroup.enabledApis
    );
  };

  const handleDeleteUserGroup = (groupName: string) => {
    // 计算会受影响的用户数量
    const affectedUsers =
      config?.UserConfig?.Users?.filter(
        (user) => user.tags && user.tags.includes(groupName)
      ) || [];

    setDeletingUserGroup({
      name: groupName,
      affectedUsers: affectedUsers.map((u) => ({
        username: u.username,
        role: u.role,
      })),
    });
    setShowDeleteUserGroupModal(true);
  };

  const handleConfirmDeleteUserGroup = async () => {
    if (!deletingUserGroup) return;

    try {
      await handleUserGroupAction('delete', deletingUserGroup.name);
      setShowDeleteUserGroupModal(false);
      setDeletingUserGroup(null);
    } catch (err) {
      // 错误处理已在 handleUserGroupAction 中处理
    }
  };

  const handleStartEditUserGroup = (group: {
    name: string;
    enabledApis: string[];
  }) => {
    setEditingUserGroup({ ...group });
    setShowEditUserGroupForm(true);
    setShowAddUserGroupForm(false);
  };

  // 为用户分配用户组
  const handleAssignUserGroup = async (
    username: string,
    userGroups: string[]
  ) => {
    return withLoading(`assignUserGroup_${username}`, async () => {
      try {
        const res = await fetch('/api/admin/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUsername: username,
            action: 'updateUserGroups',
            userGroups,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `操作失败: ${res.status}`);
        }

        await refreshConfig();
        showSuccess('用户组分配成功', showAlert);
      } catch (err) {
        showError(err instanceof Error ? err.message : '操作失败', showAlert);
        throw err;
      }
    });
  };

  const handleBanUser = async (uname: string) => {
    await withLoading(`banUser_${uname}`, () => handleUserAction('ban', uname));
  };

  const handleUnbanUser = async (uname: string) => {
    await withLoading(`unbanUser_${uname}`, () =>
      handleUserAction('unban', uname)
    );
  };

  const handleSetAdmin = async (uname: string) => {
    await withLoading(`setAdmin_${uname}`, () =>
      handleUserAction('setAdmin', uname)
    );
  };

  const handleRemoveAdmin = async (uname: string) => {
    await withLoading(`removeAdmin_${uname}`, () =>
      handleUserAction('cancelAdmin', uname)
    );
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password) return;
    await withLoading('addUser', async () => {
      await handleUserAction(
        'add',
        newUser.username,
        newUser.password,
        newUser.userGroup
      );
      setNewUser({ username: '', password: '', userGroup: '' });
      setShowAddUserForm(false);
    });
  };

  const handleChangePassword = async () => {
    if (!changePasswordUser.username || !changePasswordUser.password) return;
    await withLoading(
      `changePassword_${changePasswordUser.username}`,
      async () => {
        await handleUserAction(
          'changePassword',
          changePasswordUser.username,
          changePasswordUser.password
        );
        setChangePasswordUser({ username: '', password: '' });
        setShowChangePasswordForm(false);
      }
    );
  };

  const handleShowChangePasswordForm = (username: string) => {
    setChangePasswordUser({ username, password: '' });
    setShowChangePasswordForm(true);
    setShowAddUserForm(false); // 关闭添加用户表单
  };

  const handleDeleteUser = (username: string) => {
    setDeletingUser(username);
    setShowDeleteUserModal(true);
  };

  const handleConfigureUserApis = (user: {
    username: string;
    role: 'user' | 'admin' | 'owner';
    enabledApis?: string[];
  }) => {
    setSelectedUser(user);
    setSelectedApis(user.enabledApis || []);
    setShowConfigureApisModal(true);
  };

  const handleConfigureUserGroup = (user: {
    username: string;
    role: 'user' | 'admin' | 'owner';
    tags?: string[];
  }) => {
    setSelectedUserForGroup(user);
    setSelectedUserGroups(user.tags || []);
    setShowConfigureUserGroupModal(true);
  };

  const handleSaveUserGroups = async () => {
    if (!selectedUserForGroup) return;

    await withLoading(
      `saveUserGroups_${selectedUserForGroup.username}`,
      async () => {
        try {
          await handleAssignUserGroup(
            selectedUserForGroup.username,
            selectedUserGroups
          );
          setShowConfigureUserGroupModal(false);
          setSelectedUserForGroup(null);
          setSelectedUserGroups([]);
        } catch (err) {
          // 错误处理已在 handleAssignUserGroup 中处理
        }
      }
    );
  };

  // 处理用户选择
  const handleSelectUser = useCallback((username: string, checked: boolean) => {
    setSelectedUsers((prev) => {
      const newSelectedUsers = new Set(prev);
      if (checked) {
        newSelectedUsers.add(username);
      } else {
        newSelectedUsers.delete(username);
      }
      return newSelectedUsers;
    });
  }, []);

  const handleSelectAllUsers = useCallback(
    (checked: boolean) => {
      if (checked) {
        // 只选择自己有权限操作的用户
        const selectableUsernames =
          config?.UserConfig?.Users?.filter(
            (user) =>
              role === 'owner' ||
              (role === 'admin' &&
                (user.role === 'user' || user.username === currentUsername))
          ).map((u) => u.username) || [];
        setSelectedUsers(new Set(selectableUsernames));
      } else {
        setSelectedUsers(new Set());
      }
    },
    [config?.UserConfig?.Users, role, currentUsername]
  );

  // 批量设置用户组
  const handleBatchSetUserGroup = async (userGroup: string) => {
    if (selectedUsers.size === 0) return;

    await withLoading('batchSetUserGroup', async () => {
      try {
        const res = await fetch('/api/admin/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'batchUpdateUserGroups',
            usernames: Array.from(selectedUsers),
            userGroups: userGroup === '' ? [] : [userGroup],
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `操作失败: ${res.status}`);
        }

        const userCount = selectedUsers.size;
        setSelectedUsers(new Set());
        setShowBatchUserGroupModal(false);
        setSelectedUserGroup('');
        showSuccess(
          `已为 ${userCount} 个用户设置用户组: ${userGroup}`,
          showAlert
        );

        // 刷新配置
        await refreshConfig();
      } catch (err) {
        showError('批量设置用户组失败', showAlert);
        throw err;
      }
    });
  };

  // 提取URL域名的辅助函数
  const extractDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      // 如果URL格式不正确，返回原字符串
      return url;
    }
  };

  const handleSaveUserApis = async () => {
    if (!selectedUser) return;

    await withLoading(`saveUserApis_${selectedUser.username}`, async () => {
      try {
        const res = await fetch('/api/admin/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUsername: selectedUser.username,
            action: 'updateUserApis',
            enabledApis: selectedApis,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `操作失败: ${res.status}`);
        }

        // 成功后刷新配置
        await refreshConfig();
        setShowConfigureApisModal(false);
        setSelectedUser(null);
        setSelectedApis([]);
      } catch (err) {
        showError(err instanceof Error ? err.message : '操作失败', showAlert);
        throw err;
      }
    });
  };

  // 通用请求函数
  const handleUserAction = async (
    action:
      | 'add'
      | 'ban'
      | 'unban'
      | 'setAdmin'
      | 'cancelAdmin'
      | 'changePassword'
      | 'deleteUser',
    targetUsername: string,
    targetPassword?: string,
    userGroup?: string
  ) => {
    try {
      const res = await fetch('/api/admin/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUsername,
          ...(targetPassword ? { targetPassword } : {}),
          ...(userGroup ? { userGroup } : {}),
          action,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${res.status}`);
      }

      // 成功后刷新配置（无需整页刷新）
      await refreshConfig();
    } catch (err) {
      showError(err instanceof Error ? err.message : '操作失败', showAlert);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;

    await withLoading(`deleteUser_${deletingUser}`, async () => {
      try {
        await handleUserAction('deleteUser', deletingUser);
        setShowDeleteUserModal(false);
        setDeletingUser(null);
      } catch (err) {
        // 错误处理已在 handleUserAction 中处理
      }
    });
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载中...
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 用户统计 */}
      <div>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
          用户统计
        </h4>
        <div className='p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800'>
          <div className='text-2xl font-bold text-green-800 dark:text-green-300'>
            {config.UserConfig.Users.length}
          </div>
          <div className='text-sm text-green-600 dark:text-green-400'>
            总用户数
          </div>
        </div>
      </div>

      {/* 用户组管理 */}
      <div>
        <div className='flex items-center justify-between mb-3'>
          <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
            用户组管理
          </h4>
          <button
            onClick={() => {
              setShowAddUserGroupForm(!showAddUserGroupForm);
              if (showEditUserGroupForm) {
                setShowEditUserGroupForm(false);
                setEditingUserGroup(null);
              }
            }}
            className={
              showAddUserGroupForm
                ? buttonStyles.secondary
                : buttonStyles.primary
            }
          >
            {showAddUserGroupForm ? '取消' : '添加用户组'}
          </button>
        </div>

        {/* 用户组列表 */}
        <div className='border border-gray-200 dark:border-gray-700 rounded-lg max-h-[20rem] overflow-y-auto overflow-x-auto relative'>
          <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
            <thead className='bg-gray-50 dark:bg-gray-900 sticky top-0 z-10'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                  用户组名称
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                  可用视频源
                </th>
                <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                  操作
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
              {userGroups.map((group) => (
                <tr
                  key={group.name}
                  className='hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                >
                  <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100'>
                    {group.name}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div className='flex items-center space-x-2'>
                      <span className='text-sm text-gray-900 dark:text-gray-100'>
                        {group.enabledApis && group.enabledApis.length > 0
                          ? `${group.enabledApis.length} 个源`
                          : '无限制'}
                      </span>
                    </div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
                    <button
                      onClick={() => handleStartEditUserGroup(group)}
                      disabled={isLoading(`userGroup_edit_${group.name}`)}
                      className={`${buttonStyles.roundedPrimary} ${
                        isLoading(`userGroup_edit_${group.name}`)
                          ? 'opacity-50 cursor-not-allowed'
                          : ''
                      }`}
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDeleteUserGroup(group.name)}
                      className={buttonStyles.roundedDanger}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {userGroups.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className='px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400'
                  >
                    暂无用户组，请添加用户组来管理用户权限
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 用户列表 */}
      <div>
        <div className='flex items-center justify-between mb-3'>
          <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
            用户列表
          </h4>
          <div className='flex items-center space-x-2'>
            {/* 批量操作按钮 */}
            {selectedUsers.size > 0 && (
              <>
                <div className='flex items-center space-x-3'>
                  <span className='text-sm text-gray-600 dark:text-gray-400'>
                    已选择 {selectedUsers.size} 个用户
                  </span>
                  <button
                    onClick={() => setShowBatchUserGroupModal(true)}
                    className={buttonStyles.primary}
                  >
                    批量设置用户组
                  </button>
                </div>
                <div className='w-px h-6 bg-gray-300 dark:bg-gray-600'></div>
              </>
            )}
            <button
              onClick={() => {
                setShowAddUserForm(!showAddUserForm);
                if (showChangePasswordForm) {
                  setShowChangePasswordForm(false);
                  setChangePasswordUser({ username: '', password: '' });
                }
              }}
              className={
                showAddUserForm ? buttonStyles.secondary : buttonStyles.success
              }
            >
              {showAddUserForm ? '取消' : '添加用户'}
            </button>
          </div>
        </div>

        {/* 添加用户表单 */}
        {showAddUserForm && (
          <div className='mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700'>
            <div className='space-y-4'>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <input
                  type='text'
                  placeholder='用户名'
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                  className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                />
                <input
                  type='password'
                  placeholder='密码'
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  用户组（可选）
                </label>
                <select
                  value={newUser.userGroup}
                  onChange={(e) =>
                    setNewUser((prev) => ({
                      ...prev,
                      userGroup: e.target.value,
                    }))
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                >
                  <option value=''>无用户组（无限制）</option>
                  {userGroups.map((group) => (
                    <option key={group.name} value={group.name}>
                      {group.name} (
                      {group.enabledApis && group.enabledApis.length > 0
                        ? `${group.enabledApis.length} 个源`
                        : '无限制'}
                      )
                    </option>
                  ))}
                </select>
              </div>
              <div className='flex justify-end'>
                <button
                  onClick={handleAddUser}
                  disabled={
                    !newUser.username ||
                    !newUser.password ||
                    isLoading('addUser')
                  }
                  className={
                    !newUser.username ||
                    !newUser.password ||
                    isLoading('addUser')
                      ? buttonStyles.disabled
                      : buttonStyles.success
                  }
                >
                  {isLoading('addUser') ? '添加中...' : '添加'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 修改密码表单 */}
        {showChangePasswordForm && (
          <div className='mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700'>
            <h5 className='text-sm font-medium text-blue-800 dark:text-blue-300 mb-3'>
              修改用户密码
            </h5>
            <div className='flex flex-col sm:flex-row gap-4 sm:gap-3'>
              <input
                type='text'
                placeholder='用户名'
                value={changePasswordUser.username}
                disabled
                className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-not-allowed'
              />
              <input
                type='password'
                placeholder='新密码'
                value={changePasswordUser.password}
                onChange={(e) =>
                  setChangePasswordUser((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              />
              <button
                onClick={handleChangePassword}
                disabled={
                  !changePasswordUser.password ||
                  isLoading(`changePassword_${changePasswordUser.username}`)
                }
                className={`w-full sm:w-auto ${
                  !changePasswordUser.password ||
                  isLoading(`changePassword_${changePasswordUser.username}`)
                    ? buttonStyles.disabled
                    : buttonStyles.primary
                }`}
              >
                {isLoading(`changePassword_${changePasswordUser.username}`)
                  ? '修改中...'
                  : '修改密码'}
              </button>
              <button
                onClick={() => {
                  setShowChangePasswordForm(false);
                  setChangePasswordUser({ username: '', password: '' });
                }}
                className={`w-full sm:w-auto ${buttonStyles.secondary}`}
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 用户列表 */}
        <div
          className='border border-gray-200 dark:border-gray-700 rounded-lg max-h-[28rem] overflow-y-auto overflow-x-auto relative'
          data-table='user-list'
        >
          <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
            <thead className='bg-gray-50 dark:bg-gray-900 sticky top-0 z-10'>
              <tr>
                <th className='w-4' />
                <th className='w-10 px-1 py-3 text-center'>
                  {(() => {
                    // 检查是否有权限操作任何用户
                    const hasAnyPermission = config?.UserConfig?.Users?.some(
                      (user) =>
                        role === 'owner' ||
                        (role === 'admin' &&
                          (user.role === 'user' ||
                            user.username === currentUsername))
                    );

                    return hasAnyPermission ? (
                      <input
                        type='checkbox'
                        checked={selectAllUsers}
                        onChange={(e) => handleSelectAllUsers(e.target.checked)}
                        className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
                      />
                    ) : (
                      <div className='w-4 h-4' />
                    );
                  })()}
                </th>
                <th
                  scope='col'
                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                >
                  用户名
                </th>
                <th
                  scope='col'
                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                >
                  角色
                </th>
                <th
                  scope='col'
                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                >
                  状态
                </th>
                <th
                  scope='col'
                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                >
                  用户组
                </th>
                <th
                  scope='col'
                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                >
                  采集源权限
                </th>
                <th
                  scope='col'
                  className='px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                >
                  操作
                </th>
              </tr>
            </thead>
            {/* 按规则排序用户：自己 -> 站长(若非自己) -> 管理员 -> 其他 */}
            {(() => {
              const sortedUsers = [...config.UserConfig.Users].sort((a, b) => {
                type UserInfo = (typeof config.UserConfig.Users)[number];
                const priority = (u: UserInfo) => {
                  if (u.username === currentUsername) return 0;
                  if (u.role === 'owner') return 1;
                  if (u.role === 'admin') return 2;
                  return 3;
                };
                return priority(a) - priority(b);
              });
              return (
                <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                  {sortedUsers.map((user) => {
                    // 修改密码权限：站长可修改管理员和普通用户密码，管理员可修改普通用户和自己的密码，但任何人都不能修改站长密码
                    const canChangePassword =
                      user.role !== 'owner' && // 不能修改站长密码
                      (role === 'owner' || // 站长可以修改管理员和普通用户密码
                        (role === 'admin' &&
                          (user.role === 'user' ||
                            user.username === currentUsername))); // 管理员可以修改普通用户和自己的密码

                    // 删除用户权限：站长可删除除自己外的所有用户，管理员仅可删除普通用户
                    const canDeleteUser =
                      user.username !== currentUsername &&
                      (role === 'owner' || // 站长可以删除除自己外的所有用户
                        (role === 'admin' && user.role === 'user')); // 管理员仅可删除普通用户

                    // 其他操作权限：不能操作自己，站长可操作所有用户，管理员可操作普通用户
                    const canOperate =
                      user.username !== currentUsername &&
                      (role === 'owner' ||
                        (role === 'admin' && user.role === 'user'));
                    return (
                      <tr
                        key={user.username}
                        className='hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                      >
                        <td className='w-4' />
                        <td className='w-10 px-1 py-3 text-center'>
                          {role === 'owner' ||
                          (role === 'admin' &&
                            (user.role === 'user' ||
                              user.username === currentUsername)) ? (
                            <input
                              type='checkbox'
                              checked={selectedUsers.has(user.username)}
                              onChange={(e) =>
                                handleSelectUser(
                                  user.username,
                                  e.target.checked
                                )
                              }
                              className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
                            />
                          ) : (
                            <div className='w-4 h-4' />
                          )}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100'>
                          {user.username}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              user.role === 'owner'
                                ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                                : user.role === 'admin'
                                ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {user.role === 'owner'
                              ? '站长'
                              : user.role === 'admin'
                              ? '管理员'
                              : '普通用户'}
                          </span>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              !user.banned
                                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                            }`}
                          >
                            {!user.banned ? '正常' : '已封禁'}
                          </span>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <div className='flex items-center space-x-2'>
                            <span className='text-sm text-gray-900 dark:text-gray-100'>
                              {user.tags && user.tags.length > 0
                                ? user.tags.join(', ')
                                : '无用户组'}
                            </span>
                            {/* 配置用户组按钮 */}
                            {(role === 'owner' ||
                              (role === 'admin' &&
                                (user.role === 'user' ||
                                  user.username === currentUsername))) && (
                              <button
                                onClick={() => handleConfigureUserGroup(user)}
                                className={buttonStyles.roundedPrimary}
                              >
                                配置
                              </button>
                            )}
                          </div>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <div className='flex items-center space-x-2'>
                            <span className='text-sm text-gray-900 dark:text-gray-100'>
                              {user.enabledApis && user.enabledApis.length > 0
                                ? `${user.enabledApis.length} 个源`
                                : '无限制'}
                            </span>
                            {/* 配置采集源权限按钮 */}
                            {(role === 'owner' ||
                              (role === 'admin' &&
                                (user.role === 'user' ||
                                  user.username === currentUsername))) && (
                              <button
                                onClick={() => handleConfigureUserApis(user)}
                                className={buttonStyles.roundedPrimary}
                              >
                                配置
                              </button>
                            )}
                          </div>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
                          {/* 修改密码按钮 */}
                          {canChangePassword && (
                            <button
                              onClick={() =>
                                handleShowChangePasswordForm(user.username)
                              }
                              className={buttonStyles.roundedPrimary}
                            >
                              修改密码
                            </button>
                          )}
                          {canOperate && (
                            <>
                              {/* 其他操作按钮 */}
                              {user.role === 'user' && (
                                <button
                                  onClick={() => handleSetAdmin(user.username)}
                                  disabled={isLoading(
                                    `setAdmin_${user.username}`
                                  )}
                                  className={`${buttonStyles.roundedPurple} ${
                                    isLoading(`setAdmin_${user.username}`)
                                      ? 'opacity-50 cursor-not-allowed'
                                      : ''
                                  }`}
                                >
                                  设为管理
                                </button>
                              )}
                              {user.role === 'admin' && (
                                <button
                                  onClick={() =>
                                    handleRemoveAdmin(user.username)
                                  }
                                  disabled={isLoading(
                                    `removeAdmin_${user.username}`
                                  )}
                                  className={`${
                                    buttonStyles.roundedSecondary
                                  } ${
                                    isLoading(`removeAdmin_${user.username}`)
                                      ? 'opacity-50 cursor-not-allowed'
                                      : ''
                                  }`}
                                >
                                  取消管理
                                </button>
                              )}
                              {user.role !== 'owner' &&
                                (!user.banned ? (
                                  <button
                                    onClick={() => handleBanUser(user.username)}
                                    disabled={isLoading(
                                      `banUser_${user.username}`
                                    )}
                                    className={`${buttonStyles.roundedDanger} ${
                                      isLoading(`banUser_${user.username}`)
                                        ? 'opacity-50 cursor-not-allowed'
                                        : ''
                                    }`}
                                  >
                                    封禁
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      handleUnbanUser(user.username)
                                    }
                                    disabled={isLoading(
                                      `unbanUser_${user.username}`
                                    )}
                                    className={`${
                                      buttonStyles.roundedSuccess
                                    } ${
                                      isLoading(`unbanUser_${user.username}`)
                                        ? 'opacity-50 cursor-not-allowed'
                                        : ''
                                    }`}
                                  >
                                    解封
                                  </button>
                                ))}
                            </>
                          )}
                          {/* 删除用户按钮 - 放在最后，使用更明显的红色样式 */}
                          {canDeleteUser && (
                            <button
                              onClick={() => handleDeleteUser(user.username)}
                              className={buttonStyles.roundedDanger}
                            >
                              删除用户
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })()}
          </table>
        </div>
      </div>

      {/* 配置用户采集源权限弹窗 */}
      {showConfigureApisModal &&
        selectedUser &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => {
              setShowConfigureApisModal(false);
              setSelectedUser(null);
              setSelectedApis([]);
            }}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    配置用户采集源权限 - {selectedUser.username}
                  </h3>
                  <button
                    onClick={() => {
                      setShowConfigureApisModal(false);
                      setSelectedUser(null);
                      setSelectedApis([]);
                    }}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='mb-6'>
                  <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <svg
                        className='w-5 h-5 text-blue-600 dark:text-blue-400'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                        />
                      </svg>
                      <span className='text-sm font-medium text-blue-800 dark:text-blue-300'>
                        配置说明
                      </span>
                    </div>
                    <p className='text-sm text-blue-700 dark:text-blue-400 mt-1'>
                      提示：全不选为无限制，选中的采集源将限制用户只能访问这些源
                    </p>
                  </div>
                </div>

                {/* 采集源选择 - 多列布局 */}
                <div className='mb-6'>
                  <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-4'>
                    选择可用的采集源：
                  </h4>
                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                    {config?.SourceConfig?.map((source) => (
                      <label
                        key={source.key}
                        className='flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors'
                      >
                        <input
                          type='checkbox'
                          checked={selectedApis.includes(source.key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedApis([...selectedApis, source.key]);
                            } else {
                              setSelectedApis(
                                selectedApis.filter((api) => api !== source.key)
                              );
                            }
                          }}
                          className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700'
                        />
                        <div className='flex-1 min-w-0'>
                          <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                            {source.name}
                          </div>
                          {source.api && (
                            <div className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                              {extractDomain(source.api)}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 快速操作按钮 */}
                <div className='flex flex-wrap items-center justify-between mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg'>
                  <div className='flex space-x-2'>
                    <button
                      onClick={() => setSelectedApis([])}
                      className={buttonStyles.quickAction}
                    >
                      全不选（无限制）
                    </button>
                    <button
                      onClick={() => {
                        const allApis =
                          config?.SourceConfig?.filter(
                            (source) => !source.disabled
                          ).map((s) => s.key) || [];
                        setSelectedApis(allApis);
                      }}
                      className={buttonStyles.quickAction}
                    >
                      全选
                    </button>
                  </div>
                  <div className='text-sm text-gray-600 dark:text-gray-400'>
                    已选择：
                    <span className='font-medium text-blue-600 dark:text-blue-400'>
                      {selectedApis.length > 0
                        ? `${selectedApis.length} 个源`
                        : '无限制'}
                    </span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={() => {
                      setShowConfigureApisModal(false);
                      setSelectedUser(null);
                      setSelectedApis([]);
                    }}
                    className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.secondary}`}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveUserApis}
                    disabled={isLoading(
                      `saveUserApis_${selectedUser?.username}`
                    )}
                    className={`px-6 py-2.5 text-sm font-medium ${
                      isLoading(`saveUserApis_${selectedUser?.username}`)
                        ? buttonStyles.disabled
                        : buttonStyles.primary
                    }`}
                  >
                    {isLoading(`saveUserApis_${selectedUser?.username}`)
                      ? '配置中...'
                      : '确认配置'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 添加用户组弹窗 */}
      {showAddUserGroupForm &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => {
              setShowAddUserGroupForm(false);
              setNewUserGroup({ name: '', enabledApis: [] });
            }}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    添加新用户组
                  </h3>
                  <button
                    onClick={() => {
                      setShowAddUserGroupForm(false);
                      setNewUserGroup({ name: '', enabledApis: [] });
                    }}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='space-y-6'>
                  {/* 用户组名称 */}
                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      用户组名称
                    </label>
                    <input
                      type='text'
                      placeholder='请输入用户组名称'
                      value={newUserGroup.name}
                      onChange={(e) =>
                        setNewUserGroup((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    />
                  </div>

                  {/* 可用视频源 */}
                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4'>
                      可用视频源
                    </label>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
                      {config?.SourceConfig?.map((source) => (
                        <label
                          key={source.key}
                          className='flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors'
                        >
                          <input
                            type='checkbox'
                            checked={newUserGroup.enabledApis.includes(
                              source.key
                            )}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewUserGroup((prev) => ({
                                  ...prev,
                                  enabledApis: [
                                    ...prev.enabledApis,
                                    source.key,
                                  ],
                                }));
                              } else {
                                setNewUserGroup((prev) => ({
                                  ...prev,
                                  enabledApis: prev.enabledApis.filter(
                                    (api) => api !== source.key
                                  ),
                                }));
                              }
                            }}
                            className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700'
                          />
                          <div className='flex-1 min-w-0'>
                            <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                              {source.name}
                            </div>
                            {source.api && (
                              <div className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                                {extractDomain(source.api)}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>

                    {/* 快速操作按钮 */}
                    <div className='mt-4 flex space-x-2'>
                      <button
                        onClick={() =>
                          setNewUserGroup((prev) => ({
                            ...prev,
                            enabledApis: [],
                          }))
                        }
                        className={buttonStyles.quickAction}
                      >
                        全不选（无限制）
                      </button>
                      <button
                        onClick={() => {
                          const allApis =
                            config?.SourceConfig?.filter(
                              (source) => !source.disabled
                            ).map((s) => s.key) || [];
                          setNewUserGroup((prev) => ({
                            ...prev,
                            enabledApis: allApis,
                          }));
                        }}
                        className={buttonStyles.quickAction}
                      >
                        全选
                      </button>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className='flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700'>
                    <button
                      onClick={() => {
                        setShowAddUserGroupForm(false);
                        setNewUserGroup({ name: '', enabledApis: [] });
                      }}
                      className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.secondary}`}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleAddUserGroup}
                      disabled={
                        !newUserGroup.name.trim() ||
                        isLoading('userGroup_add_new')
                      }
                      className={`px-6 py-2.5 text-sm font-medium ${
                        !newUserGroup.name.trim() ||
                        isLoading('userGroup_add_new')
                          ? buttonStyles.disabled
                          : buttonStyles.primary
                      }`}
                    >
                      {isLoading('userGroup_add_new')
                        ? '添加中...'
                        : '添加用户组'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 编辑用户组弹窗 */}
      {showEditUserGroupForm &&
        editingUserGroup &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => {
              setShowEditUserGroupForm(false);
              setEditingUserGroup(null);
            }}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    编辑用户组 - {editingUserGroup.name}
                  </h3>
                  <button
                    onClick={() => {
                      setShowEditUserGroupForm(false);
                      setEditingUserGroup(null);
                    }}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='space-y-6'>
                  {/* 可用视频源 */}
                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4'>
                      可用视频源
                    </label>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
                      {config?.SourceConfig?.map((source) => (
                        <label
                          key={source.key}
                          className='flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors'
                        >
                          <input
                            type='checkbox'
                            checked={editingUserGroup.enabledApis.includes(
                              source.key
                            )}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditingUserGroup((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        enabledApis: [
                                          ...prev.enabledApis,
                                          source.key,
                                        ],
                                      }
                                    : null
                                );
                              } else {
                                setEditingUserGroup((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        enabledApis: prev.enabledApis.filter(
                                          (api) => api !== source.key
                                        ),
                                      }
                                    : null
                                );
                              }
                            }}
                            className='rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700'
                          />
                          <div className='flex-1 min-w-0'>
                            <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                              {source.name}
                            </div>
                            {source.api && (
                              <div className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                                {extractDomain(source.api)}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>

                    {/* 快速操作按钮 */}
                    <div className='mt-4 flex space-x-2'>
                      <button
                        onClick={() =>
                          setEditingUserGroup((prev) =>
                            prev ? { ...prev, enabledApis: [] } : null
                          )
                        }
                        className={buttonStyles.quickAction}
                      >
                        全不选（无限制）
                      </button>
                      <button
                        onClick={() => {
                          const allApis =
                            config?.SourceConfig?.filter(
                              (source) => !source.disabled
                            ).map((s) => s.key) || [];
                          setEditingUserGroup((prev) =>
                            prev ? { ...prev, enabledApis: allApis } : null
                          );
                        }}
                        className={buttonStyles.quickAction}
                      >
                        全选
                      </button>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className='flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700'>
                    <button
                      onClick={() => {
                        setShowEditUserGroupForm(false);
                        setEditingUserGroup(null);
                      }}
                      className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.secondary}`}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleEditUserGroup}
                      disabled={isLoading(
                        `userGroup_edit_${editingUserGroup?.name}`
                      )}
                      className={`px-6 py-2.5 text-sm font-medium ${
                        isLoading(`userGroup_edit_${editingUserGroup?.name}`)
                          ? buttonStyles.disabled
                          : buttonStyles.primary
                      }`}
                    >
                      {isLoading(`userGroup_edit_${editingUserGroup?.name}`)
                        ? '保存中...'
                        : '保存修改'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 配置用户组弹窗 */}
      {showConfigureUserGroupModal &&
        selectedUserForGroup &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => {
              setShowConfigureUserGroupModal(false);
              setSelectedUserForGroup(null);
              setSelectedUserGroups([]);
            }}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    配置用户组 - {selectedUserForGroup.username}
                  </h3>
                  <button
                    onClick={() => {
                      setShowConfigureUserGroupModal(false);
                      setSelectedUserForGroup(null);
                      setSelectedUserGroups([]);
                    }}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='mb-6'>
                  <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <svg
                        className='w-5 h-5 text-blue-600 dark:text-blue-400'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                        />
                      </svg>
                      <span className='text-sm font-medium text-blue-800 dark:text-blue-300'>
                        配置说明
                      </span>
                    </div>
                    <p className='text-sm text-blue-700 dark:text-blue-400 mt-1'>
                      提示：选择"无用户组"为无限制，选择特定用户组将限制用户只能访问该用户组允许的采集源
                    </p>
                  </div>
                </div>

                {/* 用户组选择 - 下拉选择器 */}
                <div className='mb-6'>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    选择用户组：
                  </label>
                  <select
                    value={
                      selectedUserGroups.length > 0 ? selectedUserGroups[0] : ''
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedUserGroups(value ? [value] : []);
                    }}
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors'
                  >
                    <option value=''>无用户组（无限制）</option>
                    {userGroups.map((group) => (
                      <option key={group.name} value={group.name}>
                        {group.name}{' '}
                        {group.enabledApis && group.enabledApis.length > 0
                          ? `(${group.enabledApis.length} 个源)`
                          : ''}
                      </option>
                    ))}
                  </select>
                  <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
                    选择"无用户组"为无限制，选择特定用户组将限制用户只能访问该用户组允许的采集源
                  </p>
                </div>

                {/* 操作按钮 */}
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={() => {
                      setShowConfigureUserGroupModal(false);
                      setSelectedUserForGroup(null);
                      setSelectedUserGroups([]);
                    }}
                    className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.secondary}`}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveUserGroups}
                    disabled={isLoading(
                      `saveUserGroups_${selectedUserForGroup?.username}`
                    )}
                    className={`px-6 py-2.5 text-sm font-medium ${
                      isLoading(
                        `saveUserGroups_${selectedUserForGroup?.username}`
                      )
                        ? buttonStyles.disabled
                        : buttonStyles.primary
                    }`}
                  >
                    {isLoading(
                      `saveUserGroups_${selectedUserForGroup?.username}`
                    )
                      ? '配置中...'
                      : '确认配置'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 删除用户组确认弹窗 */}
      {showDeleteUserGroupModal &&
        deletingUserGroup &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => {
              setShowDeleteUserGroupModal(false);
              setDeletingUserGroup(null);
            }}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    确认删除用户组
                  </h3>
                  <button
                    onClick={() => {
                      setShowDeleteUserGroupModal(false);
                      setDeletingUserGroup(null);
                    }}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='mb-6'>
                  <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <svg
                        className='w-5 h-5 text-red-600 dark:text-red-400'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                        />
                      </svg>
                      <span className='text-sm font-medium text-red-800 dark:text-red-300'>
                        危险操作警告
                      </span>
                    </div>
                    <p className='text-sm text-red-700 dark:text-red-400'>
                      删除用户组 <strong>{deletingUserGroup.name}</strong>{' '}
                      将影响所有使用该组的用户，此操作不可恢复！
                    </p>
                  </div>

                  {deletingUserGroup.affectedUsers.length > 0 ? (
                    <div className='bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4'>
                      <div className='flex items-center space-x-2 mb-2'>
                        <svg
                          className='w-5 h-5 text-yellow-600 dark:text-yellow-400'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                          />
                        </svg>
                        <span className='text-sm font-medium text-yellow-800 dark:text-yellow-300'>
                          ⚠️ 将影响 {deletingUserGroup.affectedUsers.length}{' '}
                          个用户：
                        </span>
                      </div>
                      <div className='space-y-1'>
                        {deletingUserGroup.affectedUsers.map((user, index) => (
                          <div
                            key={index}
                            className='text-sm text-yellow-700 dark:text-yellow-300'
                          >
                            • {user.username} ({user.role})
                          </div>
                        ))}
                      </div>
                      <p className='text-xs text-yellow-600 dark:text-yellow-400 mt-2'>
                        这些用户的用户组将被自动移除
                      </p>
                    </div>
                  ) : (
                    <div className='bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4'>
                      <div className='flex items-center space-x-2'>
                        <svg
                          className='w-5 h-5 text-green-600 dark:text-green-400'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M5 13l4 4L19 7'
                          />
                        </svg>
                        <span className='text-sm font-medium text-green-800 dark:text-green-300'>
                          ✅ 当前没有用户使用此用户组
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={() => {
                      setShowDeleteUserGroupModal(false);
                      setDeletingUserGroup(null);
                    }}
                    className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.secondary}`}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmDeleteUserGroup}
                    disabled={isLoading(
                      `userGroup_delete_${deletingUserGroup?.name}`
                    )}
                    className={`px-6 py-2.5 text-sm font-medium ${
                      isLoading(`userGroup_delete_${deletingUserGroup?.name}`)
                        ? buttonStyles.disabled
                        : buttonStyles.danger
                    }`}
                  >
                    {isLoading(`userGroup_delete_${deletingUserGroup?.name}`)
                      ? '删除中...'
                      : '确认删除'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 删除用户确认弹窗 */}
      {showDeleteUserModal &&
        deletingUser &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => {
              setShowDeleteUserModal(false);
              setDeletingUser(null);
            }}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    确认删除用户
                  </h3>
                  <button
                    onClick={() => {
                      setShowDeleteUserModal(false);
                      setDeletingUser(null);
                    }}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='mb-6'>
                  <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <svg
                        className='w-5 h-5 text-red-600 dark:text-red-400'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                        />
                      </svg>
                      <span className='text-sm font-medium text-red-800 dark:text-red-300'>
                        危险操作警告
                      </span>
                    </div>
                    <p className='text-sm text-red-700 dark:text-red-400'>
                      删除用户 <strong>{deletingUser}</strong>{' '}
                      将同时删除其搜索历史、播放记录和收藏夹，此操作不可恢复！
                    </p>
                  </div>

                  {/* 操作按钮 */}
                  <div className='flex justify-end space-x-3'>
                    <button
                      onClick={() => {
                        setShowDeleteUserModal(false);
                        setDeletingUser(null);
                      }}
                      className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.secondary}`}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleConfirmDeleteUser}
                      className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.danger}`}
                    >
                      确认删除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 批量设置用户组弹窗 */}
      {showBatchUserGroupModal &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => {
              setShowBatchUserGroupModal(false);
              setSelectedUserGroup('');
            }}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    批量设置用户组
                  </h3>
                  <button
                    onClick={() => {
                      setShowBatchUserGroupModal(false);
                      setSelectedUserGroup('');
                    }}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='mb-6'>
                  <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <svg
                        className='w-5 h-5 text-blue-600 dark:text-blue-400'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                        />
                      </svg>
                      <span className='text-sm font-medium text-blue-800 dark:text-blue-300'>
                        批量操作说明
                      </span>
                    </div>
                    <p className='text-sm text-blue-700 dark:text-blue-400'>
                      将为选中的 <strong>{selectedUsers.size} 个用户</strong>{' '}
                      设置用户组，选择"无用户组"为无限制
                    </p>
                  </div>

                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      选择用户组：
                    </label>
                    <select
                      onChange={(e) => setSelectedUserGroup(e.target.value)}
                      className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors'
                      value={selectedUserGroup}
                    >
                      <option value=''>无用户组（无限制）</option>
                      {userGroups.map((group) => (
                        <option key={group.name} value={group.name}>
                          {group.name}{' '}
                          {group.enabledApis && group.enabledApis.length > 0
                            ? `(${group.enabledApis.length} 个源)`
                            : ''}
                        </option>
                      ))}
                    </select>
                    <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
                      选择"无用户组"为无限制，选择特定用户组将限制用户只能访问该用户组允许的采集源
                    </p>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={() => {
                      setShowBatchUserGroupModal(false);
                      setSelectedUserGroup('');
                    }}
                    className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.secondary}`}
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleBatchSetUserGroup(selectedUserGroup)}
                    disabled={isLoading('batchSetUserGroup')}
                    className={`px-6 py-2.5 text-sm font-medium ${
                      isLoading('batchSetUserGroup')
                        ? buttonStyles.disabled
                        : buttonStyles.primary
                    }`}
                  >
                    {isLoading('batchSetUserGroup') ? '设置中...' : '确认设置'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

// 注册管理组件
interface RegistrationConfigProps {
  config: AdminConfig | null;
  role: 'owner' | 'admin' | null;
  refreshConfig: () => Promise<void>;
}

const RegistrationConfig = ({
  config: _config,
  role: _role,
  refreshConfig,
}: RegistrationConfigProps) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [registrationData, setRegistrationData] = useState<{
    settings: any;
    pendingUsers: PendingUser[];
    stats: RegistrationStats;
  } | null>(null);
  const [selectedPendingUsers, setSelectedPendingUsers] = useState<string[]>(
    []
  );

  // 自动刷新相关状态
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30秒
  const [lastDataHash, setLastDataHash] = useState<string>('');

  // 获取注册数据
  const fetchRegistrationData = async () => {
    try {
      const response = await fetch('/api/admin/registration');
      if (!response.ok) {
        throw new Error('Failed to fetch registration data');
      }
      const data = await response.json();

      // 计算数据哈希用于检测变化
      const dataHash = JSON.stringify({
        pendingCount: data.pendingUsers.length,
        pendingUsers: data.pendingUsers.map((u: any) => u.username).sort(),
      });

      // 如果数据有变化，显示通知
      if (
        lastDataHash &&
        lastDataHash !== dataHash &&
        data.pendingUsers.length > 0
      ) {
        const prevData = registrationData;
        if (
          prevData &&
          data.pendingUsers.length > prevData.pendingUsers.length
        ) {
          const newUsersCount =
            data.pendingUsers.length - prevData.pendingUsers.length;
          showAlert({
            type: 'success',
            title: '新用户注册',
            message: `有 ${newUsersCount} 个新用户等待审核`,
            timer: 3000,
          });
        }
      }

      setLastDataHash(dataHash);
      setRegistrationData(data);
    } catch (error) {
      console.error('获取注册数据失败:', error);
      showAlert({ type: 'error', title: '错误', message: '获取注册数据失败' });
    }
  };

  useEffect(() => {
    fetchRegistrationData();
  }, []);

  // 自动刷新轮询
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      fetchRegistrationData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, lastDataHash]);

  // 更新注册设置
  const handleUpdateSettings = async (newSettings: any) => {
    await withLoading('updateRegistrationSettings', async () => {
      try {
        const response = await fetch('/api/admin/registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'updateSettings',
            settings: newSettings,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update settings');
        }

        showAlert({
          type: 'success',
          title: '成功',
          message: '注册设置已更新',
          timer: 2000,
        });
        await Promise.all([refreshConfig(), fetchRegistrationData()]);
      } catch (error) {
        console.error('更新注册设置失败:', error);
        showAlert({
          type: 'error',
          title: '错误',
          message: '更新注册设置失败',
        });
      }
    });
  };

  // 批准用户
  const handleApproveUser = async (username: string) => {
    await withLoading(`approve_${username}`, async () => {
      try {
        const response = await fetch('/api/admin/registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'approve',
            username,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to approve user');
        }

        showAlert({
          type: 'success',
          title: '成功',
          message: `用户 ${username} 审核通过`,
          timer: 2000,
        });
        await Promise.all([refreshConfig(), fetchRegistrationData()]);
      } catch (error) {
        console.error('批准用户失败:', error);
        showAlert({
          type: 'error',
          title: '错误',
          message: `批准用户 ${username} 失败`,
        });
      }
    });
  };

  // 拒绝用户
  const handleRejectUser = async (username: string) => {
    await withLoading(`reject_${username}`, async () => {
      try {
        const response = await fetch('/api/admin/registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reject',
            username,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to reject user');
        }

        showAlert({
          type: 'success',
          title: '成功',
          message: `用户 ${username} 申请已拒绝`,
          timer: 2000,
        });
        await fetchRegistrationData();
      } catch (error) {
        console.error('拒绝用户失败:', error);
        showAlert({
          type: 'error',
          title: '错误',
          message: `拒绝用户 ${username} 失败`,
        });
      }
    });
  };

  // 批量操作
  const handleBatchOperation = async (action: 'approve' | 'reject') => {
    if (selectedPendingUsers.length === 0) {
      showAlert({
        type: 'warning',
        title: '提示',
        message: '请选择要操作的用户',
      });
      return;
    }

    await withLoading(`batch_${action}`, async () => {
      try {
        const response = await fetch('/api/admin/registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: `batch${action.charAt(0).toUpperCase() + action.slice(1)}`,
            usernames: selectedPendingUsers,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to ${action} users`);
        }

        const result = await response.json();
        showAlert({
          type: 'success',
          title: '成功',
          message: result.message,
          timer: 3000,
        });
        setSelectedPendingUsers([]);
        await Promise.all([refreshConfig(), fetchRegistrationData()]);
      } catch (error) {
        console.error(
          `批量${action === 'approve' ? '批准' : '拒绝'}用户失败:`,
          error
        );
        showAlert({ type: 'error', title: '错误', message: '批量操作失败' });
      }
    });
  };

  if (!registrationData) {
    return <div className='p-4 text-center text-gray-500'>加载中...</div>;
  }

  const { settings, pendingUsers, stats } = registrationData;

  return (
    <div className='space-y-6'>
      {/* 注册统计 */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <div className='bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg'>
          <div className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
            {stats.totalUsers}
          </div>
          <div className='text-sm text-blue-600 dark:text-blue-400'>
            总用户数
            {stats.maxUsers && ` / ${stats.maxUsers}`}
          </div>
        </div>
        <div className='bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg'>
          <div className='text-2xl font-bold text-orange-600 dark:text-orange-400'>
            {stats.pendingUsers}
          </div>
          <div className='text-sm text-orange-600 dark:text-orange-400'>
            待审核用户
          </div>
        </div>
        <div className='bg-green-50 dark:bg-green-900/20 p-4 rounded-lg'>
          <div className='text-2xl font-bold text-green-600 dark:text-green-400'>
            {stats.todayRegistrations}
          </div>
          <div className='text-sm text-green-600 dark:text-green-400'>
            今日注册
          </div>
        </div>
        <div
          className={`p-4 rounded-lg ${
            settings.enableRegistration
              ? 'bg-green-50 dark:bg-green-900/20'
              : 'bg-red-50 dark:bg-red-900/20'
          }`}
        >
          <div
            className={`text-2xl font-bold ${
              settings.enableRegistration
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {settings.enableRegistration ? '开启' : '关闭'}
          </div>
          <div
            className={`text-sm ${
              settings.enableRegistration
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            注册状态
          </div>
        </div>
      </div>

      {/* 注册设置 */}
      <div className='bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm'>
        <h3 className='text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100'>
          注册设置
        </h3>
        <div className='space-y-4'>
          <div className='flex items-center space-x-4'>
            <label className='flex items-center'>
              <input
                type='checkbox'
                checked={settings.enableRegistration}
                onChange={(e) =>
                  handleUpdateSettings({
                    ...settings,
                    enableRegistration: e.target.checked,
                  })
                }
                className='mr-2'
              />
              启用新用户注册
            </label>
          </div>

          {settings.enableRegistration && (
            <>
              <div className='flex items-center space-x-4'>
                <label className='flex items-center'>
                  <input
                    type='checkbox'
                    checked={settings.registrationApproval}
                    onChange={(e) =>
                      handleUpdateSettings({
                        ...settings,
                        registrationApproval: e.target.checked,
                      })
                    }
                    className='mr-2'
                  />
                  需要管理员审核
                </label>
              </div>

              <div className='flex items-center space-x-4'>
                <label className='flex items-center space-x-2'>
                  <span>最大用户数限制:</span>
                  <input
                    type='number'
                    value={settings.maxUsers || ''}
                    onChange={(e) =>
                      handleUpdateSettings({
                        ...settings,
                        maxUsers: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder='无限制'
                    className='px-3 py-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 w-24'
                    min='1'
                  />
                </label>
              </div>

              {/* 自动刷新设置 */}
              {settings.registrationApproval && (
                <>
                  <div className='border-t border-gray-200 dark:border-gray-700 pt-4 mt-4'>
                    <h4 className='text-md font-medium text-gray-900 dark:text-gray-100 mb-3'>
                      自动刷新设置
                    </h4>
                    <div className='space-y-3'>
                      <div className='flex items-center space-x-4'>
                        <label className='flex items-center'>
                          <input
                            type='checkbox'
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className='mr-2'
                          />
                          启用自动刷新
                        </label>
                      </div>

                      {autoRefresh && (
                        <div className='flex items-center space-x-4'>
                          <label className='flex items-center space-x-2'>
                            <span>刷新间隔:</span>
                            <select
                              value={refreshInterval}
                              onChange={(e) =>
                                setRefreshInterval(Number(e.target.value))
                              }
                              className='px-3 py-1 border rounded-md dark:bg-gray-700 dark:border-gray-600'
                            >
                              <option value={10000}>10秒</option>
                              <option value={30000}>30秒</option>
                              <option value={60000}>1分钟</option>
                              <option value={300000}>5分钟</option>
                            </select>
                          </label>
                        </div>
                      )}

                      <div className='text-xs text-gray-500 dark:text-gray-400'>
                        {autoRefresh
                          ? `自动检测新的待审核用户，每${
                              refreshInterval / 1000
                            }秒刷新一次`
                          : '已关闭自动刷新，需要手动刷新页面查看新用户'}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* 待审核用户列表 */}
      {settings.enableRegistration &&
        settings.registrationApproval &&
        pendingUsers.length > 0 && (
          <div className='bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm'>
            <div className='flex items-center justify-between mb-4'>
              <div className='flex items-center space-x-3'>
                <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                  待审核用户 ({pendingUsers.length})
                </h3>
                {autoRefresh && (
                  <div className='flex items-center space-x-2'>
                    <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse'></div>
                    <span className='text-xs text-gray-500 dark:text-gray-400'>
                      自动刷新中
                    </span>
                  </div>
                )}
              </div>
              {selectedPendingUsers.length > 0 && (
                <div className='space-x-2'>
                  <button
                    onClick={() => handleBatchOperation('approve')}
                    disabled={isLoading('batch_approve')}
                    className={buttonStyles.roundedSuccess}
                  >
                    批量批准 ({selectedPendingUsers.length})
                  </button>
                  <button
                    onClick={() => handleBatchOperation('reject')}
                    disabled={isLoading('batch_reject')}
                    className={buttonStyles.roundedDanger}
                  >
                    批量拒绝 ({selectedPendingUsers.length})
                  </button>
                </div>
              )}
            </div>

            <div className='overflow-x-auto'>
              <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
                <thead className='bg-gray-50 dark:bg-gray-700'>
                  <tr>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
                      <input
                        type='checkbox'
                        checked={
                          selectedPendingUsers.length === pendingUsers.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPendingUsers(
                              pendingUsers.map((u) => u.username)
                            );
                          } else {
                            setSelectedPendingUsers([]);
                          }
                        }}
                      />
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
                      用户名
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
                      注册时间
                    </th>
                    <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className='bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700'>
                  {pendingUsers.map((user) => (
                    <tr key={user.username}>
                      <td className='px-6 py-4 whitespace-nowrap'>
                        <input
                          type='checkbox'
                          checked={selectedPendingUsers.includes(user.username)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPendingUsers([
                                ...selectedPendingUsers,
                                user.username,
                              ]);
                            } else {
                              setSelectedPendingUsers(
                                selectedPendingUsers.filter(
                                  (u) => u !== user.username
                                )
                              );
                            }
                          }}
                        />
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100'>
                        {user.username}
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400'>
                        {new Date(user.registeredAt).toLocaleString()}
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
                        <button
                          onClick={() => handleApproveUser(user.username)}
                          disabled={isLoading(`approve_${user.username}`)}
                          className={buttonStyles.roundedSuccess}
                        >
                          批准
                        </button>
                        <button
                          onClick={() => handleRejectUser(user.username)}
                          disabled={isLoading(`reject_${user.username}`)}
                          className={buttonStyles.roundedDanger}
                        >
                          拒绝
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* 提示信息 */}
      {settings.enableRegistration &&
        pendingUsers.length === 0 &&
        settings.registrationApproval && (
          <div className='bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center text-blue-600 dark:text-blue-400'>
            暂无待审核的用户注册申请
          </div>
        )}

      {alertModal.isOpen && (
        <AlertModal
          isOpen={alertModal.isOpen}
          onClose={hideAlert}
          type={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
          timer={alertModal.timer}
          showConfirm={alertModal.showConfirm}
        />
      )}
    </div>
  );
};

// 视频源配置组件
const VideoSourceConfig = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [sources, setSources] = useState<AdminConfig['SourceConfig']>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);
  const [newSource, setNewSource] = useState({
    name: '',
    key: '',
    api: '',
    detail: '',
    disabled: false,
  });
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set()
  );
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<any[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('庆余年');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // dnd-kit 传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 轻微位移即可触发
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 长按 150ms 后触发，避免与滚动冲突
        tolerance: 5,
      },
    })
  );

  // 初始化
  useEffect(() => {
    if (config?.SourceConfig) {
      setSources(config.SourceConfig);
      setOrderChanged(false); // 进入时重置 orderChanged
    }
  }, [config]);

  // 筛选状态
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'enabled' | 'disabled'
  >('all');
  const [filterValidity, setFilterValidity] = useState<
    'all' | 'valid' | 'invalid' | 'no_results' | 'untested'
  >('all');

  // 创建筛选后的视频源列表
  const filteredSources = useMemo(() => {
    return sources.filter((source) => {
      // 状态筛选
      if (filterStatus === 'enabled' && source.disabled) return false;
      if (filterStatus === 'disabled' && !source.disabled) return false;

      // 有效性筛选
      const validity = source.lastCheck?.status || 'untested';
      if (filterValidity !== 'all') {
        if (filterValidity === 'invalid') {
          if (!['invalid', 'timeout', 'unreachable'].includes(validity))
            return false;
        } else if (validity !== filterValidity) {
          return false;
        }
      }
      return true;
    });
  }, [sources, filterStatus, filterValidity]);

  // 使用 useMemo 计算全选状态，依赖筛选后的列表
  const selectAll = useMemo(() => {
    if (filteredSources.length === 0) return false;
    return filteredSources.every((s) => selectedSources.has(s.key));
  }, [selectedSources, filteredSources]);

  // 筛选条件变化时，清空选择，避免操作不在视图内的项
  useEffect(() => {
    setSelectedSources(new Set());
  }, [filterStatus, filterValidity]);
  // 通用 API 请求
  const callSourceApi = async (body: Record<string, any>) => {
    try {
      const resp = await fetch('/api/admin/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${resp.status}`);
      }

      // 成功后刷新配置
      await refreshConfig();
    } catch (err) {
      showError(err instanceof Error ? err.message : '操作失败', showAlert);
      throw err; // 向上抛出方便调用处判断
    }
  };

  const handleToggleEnable = (key: string) => {
    const target = sources.find((s) => s.key === key);
    if (!target) return;
    const action = target.disabled ? 'enable' : 'disable';
    withLoading(`toggleSource_${key}`, () =>
      callSourceApi({ action, key })
    ).catch(() => {
      console.error('操作失败', action, key);
    });
  };

  const handleDelete = (key: string) => {
    withLoading(`deleteSource_${key}`, () =>
      callSourceApi({ action: 'delete', key })
    ).catch(() => {
      console.error('操作失败', 'delete', key);
    });
  };

  const handleAddSource = () => {
    if (!newSource.name || !newSource.key || !newSource.api) return;
    withLoading('addSource', async () => {
      await callSourceApi({
        action: 'add',
        key: newSource.key,
        name: newSource.name,
        api: newSource.api,
        detail: newSource.detail,
      });
      setNewSource({
        name: '',
        key: '',
        api: '',
        detail: '',
        disabled: false,
      });
      setShowAddForm(false);
    }).catch(() => {
      console.error('操作失败', 'add', newSource);
    });
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sources.findIndex((s) => s.key === active.id);
    const newIndex = sources.findIndex((s) => s.key === over.id);
    setSources((prev) => arrayMove(prev, oldIndex, newIndex));
    setOrderChanged(true);
  };

  const handleSaveOrder = () => {
    const order = sources.map((s) => s.key);
    withLoading('saveSourceOrder', () =>
      callSourceApi({ action: 'sort', order })
    )
      .then(() => {
        setOrderChanged(false);
      })
      .catch(() => {
        console.error('操作失败', 'sort', order);
      });
  };

  // 有效性检测函数
  const handleValidateSources = async () => {
    if (!searchKeyword.trim()) {
      showAlert({
        type: 'warning',
        title: '请输入搜索关键词',
        message: '搜索关键词不能为空',
      });
      return;
    }

    await withLoading('validateSources', async () => {
      setIsValidating(true);
      setValidationResults([]);
      setShowValidationModal(false);

      // 用于收集所有源的最终结果
      const collectedResults: { key: string; status: any; latency: number }[] =
        [];

      try {
        const eventSource = new EventSource(
          `/api/admin/source/validate?q=${encodeURIComponent(
            searchKeyword.trim()
          )}`
        );

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            switch (data.type) {
              case 'start':
                console.log(`开始检测 ${data.totalSources} 个视频源`);
                break;

              case 'source_result':
              case 'source_error':
                // 收集结果用于最后提交
                collectedResults.push({
                  key: data.source,
                  status: data.status,
                  latency: data.latency,
                });
                break;

              case 'complete':
                console.log(
                  `检测完成，共检测 ${data.completedSources} 个视频源`
                );
                eventSource.close();
                setIsValidating(false);

                // 检测完成，将所有结果一次性提交到后端保存
                fetch('/api/admin/source', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'update_check_results',
                    results: collectedResults,
                  }),
                })
                  .then((res) => {
                    if (!res.ok) throw new Error('保存检测结果失败');
                    showSuccess('检测完成，结果已保存', showAlert);
                    // 刷新配置以获取最新数据
                    refreshConfig();
                  })
                  .catch((err) => {
                    showError(err.message, showAlert);
                  });
                break;
            }
          } catch (error) {
            console.error('解析EventSource数据失败:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('EventSource错误:', error);
          eventSource.close();
          setIsValidating(false);
          showAlert({
            type: 'error',
            title: '验证失败',
            message: '连接错误，请重试',
          });
        };

        // 设置超时，防止长时间等待
        setTimeout(() => {
          if (eventSource.readyState === EventSource.OPEN) {
            eventSource.close();
            setIsValidating(false);
            showAlert({
              type: 'warning',
              title: '验证超时',
              message: '部分源检测超时，结果可能不完整',
            });
            // 即使超时，也尝试保存已收到的结果
            if (collectedResults.length > 0) {
              fetch('/api/admin/source', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'update_check_results',
                  results: collectedResults,
                }),
              }).then(() => refreshConfig());
            }
          }
        }, 60000); // 60秒超时
      } catch (error) {
        setIsValidating(false);
        showAlert({
          type: 'error',
          title: '验证失败',
          message: error instanceof Error ? error.message : '未知错误',
        });
        throw error;
      }
    });
  };

  // 获取有效性状态显示
  const getValidationStatus = (source: AdminConfig['SourceConfig'][0]) => {
    // 优先显示实时检测状态
    if (isValidating) {
      const liveResult = validationResults.find((r) => r.key === source.key);
      if (liveResult?.status === 'validating') {
        return {
          text: '检测中',
          className:
            'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300',
          icon: '⟳',
        };
      }
    }

    const check = source.lastCheck;
    if (!check || check.status === 'untested') {
      return {
        text: '未检测',
        className:
          'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-400',
        icon: '?',
      };
    }

    switch (check.status) {
      case 'valid':
        return {
          text: '有效',
          className:
            'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300',
          icon: '✓',
        };
      case 'no_results':
        return {
          text: '无法搜索',
          className:
            'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300',
          icon: '⚠',
        };
      case 'invalid':
      case 'timeout':
      case 'unreachable':
        return {
          text: '无效',
          className:
            'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300',
          icon: '✗',
        };
      default:
        return {
          text: '未知',
          className:
            'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-400',
          icon: '?',
        };
    }
  };

  // 可拖拽行封装 (dnd-kit)
  const DraggableRow = ({
    source,
  }: {
    source: AdminConfig['SourceConfig'][0];
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: source.key });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    } as React.CSSProperties;

    return (
      <tr
        ref={setNodeRef}
        style={style}
        className='hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors select-none'
      >
        <td
          className='px-2 py-4 cursor-grab text-gray-400'
          style={{ touchAction: 'none' }}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </td>
        <td className='px-2 py-4 text-center'>
          <input
            type='checkbox'
            checked={selectedSources.has(source.key)}
            onChange={(e) => handleSelectSource(source.key, e.target.checked)}
            className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
          />
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
          {source.name}
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
          {source.key}
        </td>
        <td
          className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 max-w-[12rem] truncate'
          title={source.api}
        >
          {source.api}
        </td>
        <td
          className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 max-w-[8rem] truncate'
          title={source.detail || '-'}
        >
          {source.detail || '-'}
        </td>
        <td className='px-6 py-4 whitespace-nowrap max-w-[1rem]'>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              !source.disabled
                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
            }`}
          >
            {!source.disabled ? '启用中' : '已禁用'}
          </span>
        </td>
        <td className='px-6 py-4 whitespace-nowrap max-w-[1rem]'>
          {(() => {
            const status = getValidationStatus(source);
            return (
              <span
                className={`px-2 py-1 text-xs rounded-full ${status.className}`}
              >
                {status.icon} {status.text}
              </span>
            );
          })()}
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm'>
          {(() => {
            const latency = source.lastCheck?.latency;
            if (typeof latency !== 'number' || latency < 0) {
              return (
                <span className='text-gray-500 dark:text-gray-400'>-</span>
              );
            }
            const colorClass =
              latency < 200
                ? 'text-green-600 dark:text-green-400'
                : latency < 1000
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-red-600 dark:text-red-400';
            return <span className={colorClass}>{latency}ms</span>;
          })()}
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
          <button
            onClick={() => handleToggleEnable(source.key)}
            disabled={isLoading(`toggleSource_${source.key}`)}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
              !source.disabled
                ? buttonStyles.roundedDanger
                : buttonStyles.roundedSuccess
            } transition-colors ${
              isLoading(`toggleSource_${source.key}`)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {!source.disabled ? '禁用' : '启用'}
          </button>
          {source.from !== 'config' && (
            <button
              onClick={() => handleDelete(source.key)}
              disabled={isLoading(`deleteSource_${source.key}`)}
              className={`${buttonStyles.roundedSecondary} ${
                isLoading(`deleteSource_${source.key}`)
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              删除
            </button>
          )}
        </td>
      </tr>
    );
  };

  // 全选/取消全选
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      const filteredKeys = new Set(filteredSources.map((s) => s.key));
      if (checked) {
        setSelectedSources((prev) => new Set([...prev, ...filteredKeys]));
      } else {
        setSelectedSources((prev) => {
          const next = new Set(prev);
          for (const key of filteredKeys) {
            next.delete(key);
          }
          return next;
        });
      }
    },
    [filteredSources]
  );

  // 单个选择
  const handleSelectSource = useCallback((key: string, checked: boolean) => {
    setSelectedSources((prev) => {
      const newSelected = new Set(prev);
      if (checked) {
        newSelected.add(key);
      } else {
        newSelected.delete(key);
      }
      return newSelected;
    });
  }, []);

  // 批量操作
  const handleBatchOperation = async (
    action:
      | 'batch_enable'
      | 'batch_disable'
      | 'batch_delete'
      | 'batch_delete_invalid'
  ) => {
    const keys =
      action === 'batch_delete_invalid' ? [] : Array.from(selectedSources);
    if (action !== 'batch_delete_invalid' && keys.length === 0) {
      showAlert({ type: 'warning', title: '请先选择要操作的视频源' });

      return;
    }

    let confirmMessage = '';
    let actionName = '';

    switch (action) {
      case 'batch_enable':
        confirmMessage = `确定要启用选中的 ${keys.length} 个视频源吗？`;
        actionName = '批量启用';
        break;
      case 'batch_disable':
        confirmMessage = `确定要禁用选中的 ${keys.length} 个视频源吗？`;
        actionName = '批量禁用';
        break;
      case 'batch_delete':
        confirmMessage = `确定要删除选中的 ${keys.length} 个视频源吗？此操作不可恢复！`;
        actionName = '批量删除';
        break;
      case 'batch_delete_invalid':
        {
          const invalidCount = sources.filter(
            (s) =>
              s.from === 'custom' &&
              s.lastCheck &&
              ['invalid', 'timeout', 'unreachable'].includes(s.lastCheck.status)
          ).length;
          if (invalidCount === 0) {
            showAlert({ type: 'info', title: '没有可清理的无效源' });
            return;
          }
          confirmMessage = `检测到 ${invalidCount} 个可清理的自定义无效源，确定要删除它们吗？`;
          actionName = '一键清理无效源';
        }
        break;
    }

    // 显示确认弹窗
    setConfirmModal({
      isOpen: true,
      title: '确认操作',
      message: confirmMessage,
      onConfirm: async () => {
        try {
          await withLoading(`batchSource_${action}`, () =>
            callSourceApi({ action, keys })
          );
          showAlert({
            type: 'success',
            title: `${actionName}成功`,
            message: `${actionName}了 ${keys.length} 个视频源`,
            timer: 2000,
          });
          // 重置选择状态
          setSelectedSources(new Set());
        } catch (err) {
          showAlert({
            type: 'error',
            title: `${actionName}失败`,
            message: err instanceof Error ? err.message : '操作失败',
          });
        }
        setConfirmModal({
          isOpen: false,
          title: '',
          message: '',
          onConfirm: () => {},
          onCancel: () => {},
        });
      },
      onCancel: () => {
        setConfirmModal({
          isOpen: false,
          title: '',
          message: '',
          onConfirm: () => {},
          onCancel: () => {},
        });
      },
    });
  };

  // 处理导出操作，增加按筛选结果导出
  const handleExport = (
    format: 'json' | 'csv' | 'text',
    scope: 'all' | 'selected' | 'filtered'
  ) => {
    let dataToExport: AdminConfig['SourceConfig'];
    switch (scope) {
      case 'selected':
        dataToExport = sources.filter((s) => selectedSources.has(s.key));
        break;
      case 'filtered':
        dataToExport = filteredSources;
        break;
      default:
        dataToExport = sources;
        break;
    }

    if (dataToExport.length === 0) {
      showAlert({ type: 'warning', title: '没有可导出的数据' });
      return;
    }

    try {
      // 当导出json时，传入cache_time
      exportData(
        dataToExport,
        format,
        config?.SiteConfig.SiteInterfaceCacheTime
      );
      setShowExportModal(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : '导出失败', showAlert);
    }
  };

  // 导入模态框组件
  const ImportModal = () => {
    const [rawText, setRawText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<{
      data: any[];
      format: string;
      errors: string[];
    } | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) {
        setFile(f);
        const reader = new FileReader();
        reader.onload = (ev) => {
          setRawText(ev.target?.result as string);
        };
        reader.readAsText(f);
      }
    };

    const handlePreview = () => {
      if (!rawText.trim()) {
        showAlert({ type: 'warning', title: '请输入或上传数据' });
        return;
      }
      const existingKeys = new Set(sources.map((s) => s.key));
      const result = parseImportData(rawText, existingKeys);
      setPreview(result);
    };

    const handleConfirmImport = async () => {
      if (!preview || preview.data.length === 0) {
        showAlert({ type: 'error', title: '数据校验失败或无数据可导入' });
        return;
      }
      if (preview.errors.length > 0) {
        showAlert({
          type: 'warning',
          title: '数据存在问题',
          message: '请处理所有错误后再导入',
        });
        return;
      }
      setIsImporting(true);
      try {
        const result = await withLoading('batchImport', () =>
          callSourceApi({ action: 'batch_import', sources: preview.data })
        );
        showSuccess(result.message || '导入成功', showAlert);
        setShowImportModal(false);
      } catch (err) {
        // 错误已由 callSourceApi 和 withLoading 处理
      } finally {
        setIsImporting(false);
      }
    };

    return createPortal(
      <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col'>
          <div className='p-4 border-b dark:border-gray-700'>
            <h3 className='text-lg font-semibold'>导入视频源</h3>
          </div>
          <div className='p-6 space-y-4 overflow-y-auto'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {/* Left: Input */}
              <div className='space-y-3'>
                <label className='block text-sm font-medium'>
                  粘贴文本内容
                </label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder='在此处粘贴 JSON, CSV, 或纯文本(一行一个API地址)...'
                  className='w-full h-40 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600'
                />
                <div className='flex items-center justify-center w-full'>
                  <label
                    htmlFor='dropzone-file'
                    className='flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700'
                  >
                    <div className='flex flex-col items-center justify-center pt-5 pb-6'>
                      <Upload className='w-8 h-8 mb-2 text-gray-500' />
                      <p className='mb-1 text-sm text-gray-500'>
                        <span className='font-semibold'>点击上传</span>{' '}
                        或拖拽文件
                      </p>
                      <p className='text-xs text-gray-500'>
                        {file ? file.name : 'JSON, CSV, or TXT'}
                      </p>
                    </div>
                    <input
                      id='dropzone-file'
                      type='file'
                      className='hidden'
                      onChange={handleFileChange}
                      accept='.json,.csv,.txt'
                    />
                  </label>
                </div>
                <button
                  onClick={handlePreview}
                  className={`${buttonStyles.primary} w-full`}
                >
                  预览和校验数据
                </button>
              </div>

              {/* Right: Preview */}
              <div className='space-y-3'>
                <label className='block text-sm font-medium'>
                  数据预览与校验
                </label>
                {!preview && (
                  <div className='h-full flex items-center justify-center text-gray-500 bg-gray-50 dark:bg-gray-700/50 rounded-md'>
                    点击预览按钮后显示结果
                  </div>
                )}
                {preview && (
                  <div className='space-y-2'>
                    <div className='flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded'>
                      {preview.errors.length === 0 ? (
                        <CheckCircle className='text-green-500' />
                      ) : (
                        <AlertCircle className='text-red-500' />
                      )}
                      <p className='text-sm'>
                        检测到{' '}
                        <span className='font-bold'>
                          {preview.format.toUpperCase()}
                        </span>{' '}
                        格式, 共{' '}
                        <span className='font-bold'>
                          {preview.data.length}
                        </span>{' '}
                        条有效记录, 发现{' '}
                        <span
                          className={`font-bold ${
                            preview.errors.length > 0
                              ? 'text-red-500'
                              : 'text-green-500'
                          }`}
                        >
                          {preview.errors.length}
                        </span>{' '}
                        个问题。
                      </p>
                    </div>
                    {preview.errors.length > 0 && (
                      <div className='p-2 border border-red-500/50 bg-red-50 dark:bg-red-900/20 rounded-md max-h-24 overflow-y-auto text-sm'>
                        <ul className='list-disc list-inside'>
                          {preview.errors.slice(0, 5).map((err, i) => (
                            <li
                              key={i}
                              className='text-red-600 dark:text-red-400'
                            >
                              {err}
                            </li>
                          ))}
                          {preview.errors.length > 5 && (
                            <li>
                              ...还有 {preview.errors.length - 5} 个问题
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                    <div className='border rounded-md max-h-48 overflow-y-auto'>
                      <table className='w-full text-sm text-left'>
                        <thead className='bg-gray-50 dark:bg-gray-900 sticky top-0'>
                          <tr>
                            <th className='p-2'>Name</th>
                            <th className='p-2'>Key</th>
                            <th className='p-2'>API</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.data.map((item, i) => (
                            <tr
                              key={i}
                              className='border-t dark:border-gray-700'
                            >
                              <td className='p-2 truncate'>{item.name}</td>
                              <td className='p-2 truncate'>{item.key}</td>
                              <td
                                className='p-2 truncate'
                                title={item.api}
                              >
                                {item.api}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className='p-4 flex justify-end gap-2 border-t dark:border-gray-700'>
            <button
              onClick={() => setShowImportModal(false)}
              className={buttonStyles.secondary}
            >
              取消
            </button>
            <button
              onClick={handleConfirmImport}
              className={buttonStyles.success}
              disabled={
                isImporting ||
                !preview ||
                preview.errors.length > 0 ||
                preview.data.length === 0
              }
            >
              {isImporting ? '导入中...' : '确认导入'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // 导出模态框组件
  const ExportModal = () => {
    const [format, setFormat] = useState<'json' | 'csv' | 'text'>('json');
    const [scope, setScope] = useState<'all' | 'selected'>('all');
    const selectedCount = selectedSources.size;

    return createPortal(
      <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md'>
          <div className='p-4 border-b dark:border-gray-700'>
            <h3 className='text-lg font-semibold'>导出视频源</h3>
          </div>
          <div className='p-6 space-y-6'>
            <div>
              <label className='text-sm font-medium'>导出范围</label>
              <div className='mt-2 flex gap-4'>
                <label className='flex items-center gap-2'>
                  <input
                    type='radio'
                    name='scope'
                    value='all'
                    checked={scope === 'all'}
                    onChange={() => setScope('all')}
                  />{' '}
                  全部 ({sources.length}项)
                </label>
                <label className='flex items-center gap-2'>
                  <input
                    type='radio'
                    name='scope'
                    value='selected'
                    checked={scope === 'selected'}
                    onChange={() => setScope('selected')}
                    disabled={selectedCount === 0}
                  />{' '}
                  选中项 ({selectedCount}项)
                </label>
              </div>
            </div>
            <div>
              <label className='text-sm font-medium'>导出格式</label>
              <div className='mt-2 grid grid-cols-3 gap-2'>
                <button
                  onClick={() => setFormat('json')}
                  className={`${
                    buttonStyles.primary
                  } flex items-center justify-center ${
                    format !== 'json'
                      ? '!bg-gray-200 !text-gray-800 dark:!bg-gray-700 dark:!text-gray-200'
                      : ''
                  }`}
                >
                  <FileJson size={16} className='mr-1' /> JSON
                </button>
                <button
                  onClick={() => setFormat('csv')}
                  className={`${
                    buttonStyles.primary
                  } flex items-center justify-center ${
                    format !== 'csv'
                      ? '!bg-gray-200 !text-gray-800 dark:!bg-gray-700 dark:!text-gray-200'
                      : ''
                  }`}
                >
                  <Sheet size={16} className='mr-1' /> CSV
                </button>
                <button
                  onClick={() => setFormat('text')}
                  className={`${
                    buttonStyles.primary
                  } flex items-center justify-center ${
                    format !== 'text'
                      ? '!bg-gray-200 !text-gray-800 dark:!bg-gray-700 dark:!text-gray-200'
                      : ''
                  }`}
                >
                  <FileText size={16} className='mr-1' /> 纯文本
                </button>
              </div>
              <p className='text-xs text-gray-500 mt-2'>
                纯文本格式仅导出API地址。
              </p>
            </div>
          </div>
          <div className='p-4 flex justify-end gap-2 border-t dark:border-gray-700'>
            <button
              onClick={() => setShowExportModal(false)}
              className={buttonStyles.secondary}
            >
              取消
            </button>
            <button
              onClick={() => handleExport(format, scope)}
              className={buttonStyles.success}
            >
              导出
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载中...
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
          视频源列表 ({sources.length})
        </h4>
        <div className='flex items-center flex-wrap gap-2'>
          <button
            onClick={() => setShowImportModal(true)}
            className={buttonStyles.primary}
          >
            导入
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className={buttonStyles.primary}
          >
            导出
          </button>
          <button
            onClick={() => handleBatchOperation('batch_delete_invalid')}
            className={buttonStyles.danger}
          >
            一键清理无效源
          </button>
          <button
            onClick={() => setShowValidationModal(true)}
            disabled={isValidating}
            className={`flex items-center gap-1 ${
              isValidating ? buttonStyles.disabled : buttonStyles.primary
            }`}
          >
            {isValidating && (
              <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
            )}
            {isValidating ? '检测中...' : '有效性检测'}
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={
              showAddForm ? buttonStyles.secondary : buttonStyles.success
            }
          >
            {showAddForm ? '取消' : '添加视频源'}
          </button>
        </div>
      </div>

      {/* 筛选和批量操作栏 */}
      <div className='bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4 border dark:border-gray-700'>
        <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
          <div>
            <label className='text-xs mr-2 text-gray-600 dark:text-gray-400'>
              状态:
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className='text-xs pl-2 pr-7 py-1 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500'
            >
              <option value='all'>全部</option>
              <option value='enabled'>启用中</option>
              <option value='disabled'>已禁用</option>
            </select>
          </div>
          <div>
            <label className='text-xs mr-2 text-gray-600 dark:text-gray-400'>
              有效性:
            </label>
            <select
              value={filterValidity}
              onChange={(e) => setFilterValidity(e.target.value as any)}
              className='text-xs pl-2 pr-7 py-1 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500'
            >
              <option value='all'>全部</option>
              <option value='valid'>有效</option>
              <option value='no_results'>无法搜索</option>
              <option value='invalid'>无效</option>
              <option value='untested'>未检测</option>
            </select>
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-sm text-gray-600 dark:text-gray-400'>
            已选择 {selectedSources.size} / {filteredSources.length} 项
          </span>
          <button
            onClick={() => handleBatchOperation('batch_enable')}
            disabled={
              isLoading('batchSource_batch_enable') || selectedSources.size === 0
            }
            className={buttonStyles.successSmall}
          >
            批量启用
          </button>
          <button
            onClick={() => handleBatchOperation('batch_disable')}
            disabled={
              isLoading('batchSource_batch_disable') ||
              selectedSources.size === 0
            }
            className={buttonStyles.warningSmall}
          >
            批量禁用
          </button>
          <button
            onClick={() => handleBatchOperation('batch_delete')}
            disabled={
              isLoading('batchSource_batch_delete') || selectedSources.size === 0
            }
            className={buttonStyles.dangerSmall}
          >
            批量删除
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <input
              type='text'
              placeholder='名称'
              value={newSource.name}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, name: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='Key'
              value={newSource.key}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, key: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='API 地址'
              value={newSource.api}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, api: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='Detail 地址（选填）'
              value={newSource.detail}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, detail: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>
          <div className='flex justify-end'>
            <button
              onClick={handleAddSource}
              disabled={
                !newSource.name ||
                !newSource.key ||
                !newSource.api ||
                isLoading('addSource')
              }
              className={`w-full sm:w-auto px-4 py-2 ${
                !newSource.name ||
                !newSource.key ||
                !newSource.api ||
                isLoading('addSource')
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('addSource') ? '添加中...' : '添加'}
            </button>
          </div>
        </div>
      )}

      {/* 视频源表格 */}
      <div
        className='border border-gray-200 dark:border-gray-700 rounded-lg max-h-[28rem] overflow-y-auto overflow-x-auto relative'
        data-table='source-list'
      >
        <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
          <thead className='bg-gray-50 dark:bg-gray-900 sticky top-0 z-10'>
            <tr>
              <th className='w-8' />
              <th className='w-12 px-2 py-3 text-center'>
                <input
                  type='checkbox'
                  checked={selectAll}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
                />
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                名称
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                Key
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                API 地址
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                Detail 地址
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                状态
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                有效性
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                延迟
              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                操作
              </th>
            </tr>
          </thead>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            autoScroll={false}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          >
            <SortableContext
              items={sources.map((s) => s.key)}
              strategy={verticalListSortingStrategy}
            >
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {filteredSources.map((source) => (
                  <DraggableRow key={source.key} source={source} />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      {/* 保存排序按钮 */}
      {orderChanged && (
        <div className='flex justify-end'>
          <button
            onClick={handleSaveOrder}
            disabled={isLoading('saveSourceOrder')}
            className={`px-3 py-1.5 text-sm ${
              isLoading('saveSourceOrder')
                ? buttonStyles.disabled
                : buttonStyles.primary
            }`}
          >
            {isLoading('saveSourceOrder') ? '保存中...' : '保存排序'}
          </button>
        </div>
      )}

      {/* 有效性检测弹窗 */}
      {showValidationModal &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
            onClick={() => setShowValidationModal(false)}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4'
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-4'>
                视频源有效性检测
              </h3>
              <p className='text-sm text-gray-600 dark:text-gray-400 mb-4'>
                请输入检测用的搜索关键词
              </p>
              <div className='space-y-4'>
                <input
                  type='text'
                  placeholder='请输入搜索关键词'
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  onKeyPress={(e) =>
                    e.key === 'Enter' && handleValidateSources()
                  }
                />
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={() => setShowValidationModal(false)}
                    className='px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors'
                  >
                    取消
                  </button>
                  <button
                    onClick={handleValidateSources}
                    disabled={!searchKeyword.trim()}
                    className={`px-4 py-2 ${
                      !searchKeyword.trim()
                        ? buttonStyles.disabled
                        : buttonStyles.primary
                    }`}
                  >
                    开始检测
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 渲染模态框 */}
      {showImportModal && <ImportModal />}
      {showExportModal && <ExportModal />}

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />

      {/* 批量操作确认弹窗 */}
      {confirmModal.isOpen &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={confirmModal.onCancel}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-4'>
                  <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                    {confirmModal.title}
                  </h3>
                  <button
                    onClick={confirmModal.onCancel}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-5 h-5'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='mb-6'>
                  <p className='text-sm text-gray-600 dark:text-gray-400'>
                    {confirmModal.message}
                  </p>
                </div>

                {/* 操作按钮 */}
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={confirmModal.onCancel}
                    className={`px-4 py-2 text-sm font-medium ${buttonStyles.secondary}`}
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmModal.onConfirm}
                    disabled={
                      isLoading('batchSource_batch_enable') ||
                      isLoading('batchSource_batch_disable') ||
                      isLoading('batchSource_batch_delete')
                    }
                    className={`px-4 py-2 text-sm font-medium ${
                      isLoading('batchSource_batch_enable') ||
                      isLoading('batchSource_batch_disable') ||
                      isLoading('batchSource_batch_delete')
                        ? buttonStyles.disabled
                        : buttonStyles.primary
                    }`}
                  >
                    {isLoading('batchSource_batch_enable') ||
                    isLoading('batchSource_batch_disable') ||
                    isLoading('batchSource_batch_delete')
                      ? '操作中...'
                      : '确认'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

// 分类配置组件
const CategoryConfig = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);
  const [newCategory, setNewCategory] = useState<CustomCategory>({
    name: '',
    type: 'movie',
    query: '',
    disabled: false,
    from: 'config',
  });

  // dnd-kit 传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 轻微位移即可触发
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 长按 150ms 后触发，避免与滚动冲突
        tolerance: 5,
      },
    })
  );

  // 初始化
  useEffect(() => {
    if (config?.CustomCategories) {
      setCategories(config.CustomCategories);
      // 进入时重置 orderChanged
      setOrderChanged(false);
    }
  }, [config]);

  // 通用 API 请求
  const callCategoryApi = async (body: Record<string, any>) => {
    try {
      const resp = await fetch('/api/admin/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${resp.status}`);
      }

      // 成功后刷新配置
      await refreshConfig();
    } catch (err) {
      showError(err instanceof Error ? err.message : '操作失败', showAlert);
      throw err; // 向上抛出方便调用处判断
    }
  };

  const handleToggleEnable = (query: string, type: 'movie' | 'tv') => {
    const target = categories.find((c) => c.query === query && c.type === type);
    if (!target) return;
    const action = target.disabled ? 'enable' : 'disable';
    withLoading(`toggleCategory_${query}_${type}`, () =>
      callCategoryApi({ action, query, type })
    ).catch(() => {
      console.error('操作失败', action, query, type);
    });
  };

  const handleDelete = (query: string, type: 'movie' | 'tv') => {
    withLoading(`deleteCategory_${query}_${type}`, () =>
      callCategoryApi({ action: 'delete', query, type })
    ).catch(() => {
      console.error('操作失败', 'delete', query, type);
    });
  };

  const handleAddCategory = () => {
    if (!newCategory.name || !newCategory.query) return;
    withLoading('addCategory', async () => {
      await callCategoryApi({
        action: 'add',
        name: newCategory.name,
        type: newCategory.type,
        query: newCategory.query,
      });
      setNewCategory({
        name: '',
        type: 'movie',
        query: '',
        disabled: false,
        from: 'custom',
      });
      setShowAddForm(false);
    }).catch(() => {
      console.error('操作失败', 'add', newCategory);
    });
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex(
      (c) => `${c.query}:${c.type}` === active.id
    );
    const newIndex = categories.findIndex(
      (c) => `${c.query}:${c.type}` === over.id
    );
    setCategories((prev) => arrayMove(prev, oldIndex, newIndex));
    setOrderChanged(true);
  };

  const handleSaveOrder = () => {
    const order = categories.map((c) => `${c.query}:${c.type}`);
    withLoading('saveCategoryOrder', () =>
      callCategoryApi({ action: 'sort', order })
    )
      .then(() => {
        setOrderChanged(false);
      })
      .catch(() => {
        console.error('操作失败', 'sort', order);
      });
  };

  // 可拖拽行封装 (dnd-kit)
  const DraggableRow = ({ category }: { category: CustomCategory }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: `${category.query}:${category.type}` });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    } as React.CSSProperties;

    return (
      <tr
        ref={setNodeRef}
        style={style}
        className='hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors select-none'
      >
        <td
          className='px-2 py-4 cursor-grab text-gray-400'
          style={{ touchAction: 'none' }}
          {...{ ...attributes, ...listeners }}
        >
          <GripVertical size={16} />
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
          {category.name || '-'}
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              category.type === 'movie'
                ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                : 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
            }`}
          >
            {category.type === 'movie' ? '电影' : '电视剧'}
          </span>
        </td>
        <td
          className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 max-w-[12rem] truncate'
          title={category.query}
        >
          {category.query}
        </td>
        <td className='px-6 py-4 whitespace-nowrap max-w-[1rem]'>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              !category.disabled
                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
            }`}
          >
            {!category.disabled ? '启用中' : '已禁用'}
          </span>
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
          <button
            onClick={() => handleToggleEnable(category.query, category.type)}
            disabled={isLoading(
              `toggleCategory_${category.query}_${category.type}`
            )}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
              !category.disabled
                ? buttonStyles.roundedDanger
                : buttonStyles.roundedSuccess
            } transition-colors ${
              isLoading(`toggleCategory_${category.query}_${category.type}`)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {!category.disabled ? '禁用' : '启用'}
          </button>
          {category.from !== 'config' && (
            <button
              onClick={() => handleDelete(category.query, category.type)}
              disabled={isLoading(
                `deleteCategory_${category.query}_${category.type}`
              )}
              className={`${buttonStyles.roundedSecondary} ${
                isLoading(`deleteCategory_${category.query}_${category.type}`)
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              删除
            </button>
          )}
        </td>
      </tr>
    );
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载中...
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 添加分类表单 */}
      <div className='flex items-center justify-between'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
          自定义分类列表
        </h4>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
            showAddForm ? buttonStyles.secondary : buttonStyles.success
          }`}
        >
          {showAddForm ? '取消' : '添加分类'}
        </button>
      </div>

      {showAddForm && (
        <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <input
              type='text'
              placeholder='分类名称'
              value={newCategory.name}
              onChange={(e) =>
                setNewCategory((prev) => ({ ...prev, name: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <select
              value={newCategory.type}
              onChange={(e) =>
                setNewCategory((prev) => ({
                  ...prev,
                  type: e.target.value as 'movie' | 'tv',
                }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            >
              <option value='movie'>电影</option>
              <option value='tv'>电视剧</option>
            </select>
            <input
              type='text'
              placeholder='搜索关键词'
              value={newCategory.query}
              onChange={(e) =>
                setNewCategory((prev) => ({ ...prev, query: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>
          <div className='flex justify-end'>
            <button
              onClick={handleAddCategory}
              disabled={
                !newCategory.name ||
                !newCategory.query ||
                isLoading('addCategory')
              }
              className={`w-full sm:w-auto px-4 py-2 ${
                !newCategory.name ||
                !newCategory.query ||
                isLoading('addCategory')
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('addCategory') ? '添加中...' : '添加'}
            </button>
          </div>
        </div>
      )}

      {/* 分类表格 */}
      <div className='border border-gray-200 dark:border-gray-700 rounded-lg max-h-[28rem] overflow-y-auto overflow-x-auto relative'>
        <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
          <thead className='bg-gray-50 dark:bg-gray-900 sticky top-0 z-10'>
            <tr>
              <th className='w-8' />
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                分类名称
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                类型
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                搜索关键词
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                状态
              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                操作
              </th>
            </tr>
          </thead>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            autoScroll={false}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          >
            <SortableContext
              items={categories.map((c) => `${c.query}:${c.type}`)}
              strategy={verticalListSortingStrategy}
            >
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {categories.map((category) => (
                  <DraggableRow
                    key={`${category.query}:${category.type}`}
                    category={category}
                  />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      {/* 保存排序按钮 */}
      {orderChanged && (
        <div className='flex justify-end'>
          <button
            onClick={handleSaveOrder}
            disabled={isLoading('saveCategoryOrder')}
            className={`px-3 py-1.5 text-sm ${
              isLoading('saveCategoryOrder')
                ? buttonStyles.disabled
                : buttonStyles.primary
            }`}
          >
            {isLoading('saveCategoryOrder') ? '保存中...' : '保存排序'}
          </button>
        </div>
      )}

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

// 新增配置文件组件
const ConfigFileComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [configContent, setConfigContent] = useState('');
  const [subscriptionUrl, setSubscriptionUrl] = useState('');
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');

  useEffect(() => {
    if (config?.ConfigFile) {
      setConfigContent(config.ConfigFile);
    }
    if (config?.ConfigSubscribtion) {
      setSubscriptionUrl(config.ConfigSubscribtion.URL);
      setAutoUpdate(config.ConfigSubscribtion.AutoUpdate);
      setLastCheckTime(config.ConfigSubscribtion.LastCheck || '');
    }
  }, [config]);

  // 拉取订阅配置
  const handleFetchConfig = async () => {
    if (!subscriptionUrl.trim()) {
      showError('请输入订阅URL', showAlert);
      return;
    }

    await withLoading('fetchConfig', async () => {
      try {
        const resp = await fetch('/api/admin/config_subscription/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: subscriptionUrl }),
        });

        const data = await resp.json().catch(() => ({})); // 保证data总是一个对象

        if (!resp.ok) {
          // 优先使用后端返回的错误信息
          const errorMessage = data.error || `拉取失败: HTTP ${resp.status}`;
          throw new Error(errorMessage);
        }

        if (data.configContent) {
          setConfigContent(data.configContent);
          const currentTime = new Date().toISOString();
          setLastCheckTime(currentTime);
          showSuccess('配置拉取成功', showAlert);
        } else {
          showError('拉取失败：未获取到配置内容', showAlert);
        }
      } catch (err) {
        // 将具体的错误信息展示给用户
        showError(err instanceof Error ? err.message : '发生未知错误', showAlert);
        // 此处不需要再向上抛出错误，因为 withLoading 已经处理了
      }
    });
  };

  // 保存配置文件
  const handleSave = async () => {
    await withLoading('saveConfig', async () => {
      try {
        const resp = await fetch('/api/admin/config_file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            configFile: configContent,
            subscriptionUrl,
            autoUpdate,
            lastCheckTime: lastCheckTime || new Date().toISOString(),
          }),
        });

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || `保存失败: ${resp.status}`);
        }

        showSuccess('配置文件保存成功', showAlert);
        await refreshConfig();
      } catch (err) {
        showError(err instanceof Error ? err.message : '保存失败', showAlert);
        throw err;
      }
    });
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载中...
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* 配置订阅区域 */}
      <div className='bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm'>
        <div className='flex items-center justify-between mb-6'>
          <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
            配置订阅
          </h3>
          <div className='text-sm text-gray-500 dark:text-gray-400 px-3 py-1.5 rounded-full'>
            最后更新:{' '}
            {lastCheckTime
              ? new Date(lastCheckTime).toLocaleString('zh-CN')
              : '从未更新'}
          </div>
        </div>

        <div className='space-y-6'>
          {/* 订阅URL输入 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
              订阅URL
            </label>
            <input
              type='url'
              value={subscriptionUrl}
              onChange={(e) => setSubscriptionUrl(e.target.value)}
              placeholder='https://example.com/config.json'
              disabled={false}
              className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 shadow-sm hover:border-gray-400 dark:hover:border-gray-500'
            />
            <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
              输入配置文件的订阅地址，要求 JSON 格式，且使用 Base58 编码
            </p>
          </div>

          {/* 拉取配置按钮 */}
          <div className='pt-2'>
            <button
              onClick={handleFetchConfig}
              disabled={isLoading('fetchConfig') || !subscriptionUrl.trim()}
              className={`w-full px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                isLoading('fetchConfig') || !subscriptionUrl.trim()
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('fetchConfig') ? (
                <div className='flex items-center justify-center gap-2'>
                  <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                  拉取中…
                </div>
              ) : (
                '拉取配置'
              )}
            </button>
          </div>

          {/* 自动更新开关 */}
          <div className='flex items-center justify-between'>
            <div>
              <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                自动更新
              </label>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                启用后系统将定期自动拉取最新配置
              </p>
            </div>
            <button
              type='button'
              onClick={() => setAutoUpdate(!autoUpdate)}
              disabled={false}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                autoUpdate ? buttonStyles.toggleOn : buttonStyles.toggleOff
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full ${
                  buttonStyles.toggleThumb
                } transition-transform ${
                  autoUpdate
                    ? buttonStyles.toggleThumbOn
                    : buttonStyles.toggleThumbOff
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 配置文件编辑区域 */}
      <div className='space-y-4'>
        <div className='relative'>
          <textarea
            value={configContent}
            onChange={(e) => setConfigContent(e.target.value)}
            rows={20}
            placeholder='请输入配置文件内容（JSON 格式）...'
            disabled={false}
            className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm leading-relaxed resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-400 dark:hover:border-gray-500'
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
            }}
            spellCheck={false}
            data-gramm={false}
          />
        </div>

        <div className='flex items-center justify-between'>
          <div className='text-xs text-gray-500 dark:text-gray-400'>
            支持 JSON 格式，用于配置视频源和自定义分类
          </div>
          <button
            onClick={handleSave}
            disabled={isLoading('saveConfig')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isLoading('saveConfig')
                ? buttonStyles.disabled
                : buttonStyles.success
            }`}
          >
            {isLoading('saveConfig') ? '保存中…' : '保存'}
          </button>
        </div>
      </div>

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

// 新增站点配置组件
const SiteConfigComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [siteSettings, setSiteSettings] = useState<SiteConfig>({ // 使用 any 避免初始化时的类型问题
    SiteName: '',
    Announcement: '',
    SearchDownstreamMaxPage: 1,
    SiteInterfaceCacheTime: 7200,
    DoubanProxyType: 'cmliussss-cdn-tencent',
    DoubanProxy: '',
    DoubanImageProxyType: 'cmliussss-cdn-tencent',
    DoubanImageProxy: '',
    DisableYellowFilter: false,
    FluidSearch: true,
    // 初始化新增字段
    IntelligentFilter: {
      enabled: false,
      provider: 'sightengine',
      confidence: 0.85,
      options: {
        sightengine: { apiUrl: '', apiUser: '', apiSecret: '' },
        custom: { apiUrl: '', apiKeyHeader: '', apiKeyValue: '', jsonBodyTemplate: '', responseScorePath: '' },
        baidu: { apiKey: '', secretKey: '' },
        aliyun: { accessKeyId: '', accessKeySecret: '', regionId: 'cn-shanghai' },
        tencent: { secretId: '', secretKey: '', region: 'ap-shanghai' },
      },
    },
    // --- 新增字段以匹配 SiteConfig 类型 ---
    EnableRegistration: false,
    RegistrationApproval: true,
    LinuxDoOAuth: {
      enabled: false,
      autoRegister: false,
      minTrustLevel: 3,
      defaultRole: 'user',
      clientId: '',
      clientSecret: '',
      authorizeUrl: 'https://connect.linux.do/oauth2/authorize',
      tokenUrl: 'https://connect.linux.do/oauth2/token',
      userInfoUrl: 'https://connect.linux.do/api/user',
    },
  });
  // 新增：API测试相关状态
  const [isApiTesting, setIsApiTesting] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isApiVerified, setIsApiVerified] = useState(false);
  // 新增：创建更健壮、可复用的状态更新函数
  const handleIntelligentFilterChange = (
    key: keyof SiteConfig['IntelligentFilter'],
    value: any
  ) => {
    setSiteSettings((prev) => ({
      ...prev,
      IntelligentFilter: {
        ...prev.IntelligentFilter!,
        [key]: value,
      },
    }));
  };
  const handleFilterOptionChange = (
    provider: 'sightengine' | 'custom' | 'baidu' | 'aliyun' | 'tencent',
    key: string,
    value: string
  ) => {
    setSiteSettings((prev) => ({
      ...prev,
      IntelligentFilter: {
        ...prev.IntelligentFilter!,
        options: {
          ...prev.IntelligentFilter!.options,
          [provider]: {
            ...prev.IntelligentFilter!.options[provider]!,
            [key]: value,
          },
        },
      },
    }));
  };
  // 豆瓣数据源相关状态
  const [isDoubanDropdownOpen, setIsDoubanDropdownOpen] = useState(false);
  const [isDoubanImageProxyDropdownOpen, setIsDoubanImageProxyDropdownOpen] =
    useState(false);

  // 豆瓣数据源选项
  const doubanDataSourceOptions = [
    { value: 'direct', label: '直连（服务器直接请求豆瓣）' },
    { value: 'cors-proxy-zwei', label: 'Cors Proxy By Zwei' },
    {
      value: 'cmliussss-cdn-tencent',
      label: '豆瓣 CDN By CMLiussss（腾讯云）',
    },
    { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
    { value: 'custom', label: '自定义代理' },
  ];

  // 豆瓣图片代理选项
  const doubanImageProxyTypeOptions = [
    { value: 'direct', label: '直连（浏览器直接请求豆瓣）' },
    { value: 'server', label: '服务器代理（由服务器代理请求豆瓣）' },
    { value: 'img3', label: '豆瓣官方精品 CDN（阿里云）' },
    {
      value: 'cmliussss-cdn-tencent',
      label: '豆瓣 CDN By CMLiussss（腾讯云）',
    },
    { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
    { value: 'custom', label: '自定义代理' },
  ];

  // 获取感谢信息
  const getThanksInfo = (dataSource: string) => {
    switch (dataSource) {
      case 'cors-proxy-zwei':
        return {
          text: 'Thanks to @Zwei',
          url: 'https://github.com/bestzwei',
        };
      case 'cmliussss-cdn-tencent':
      case 'cmliussss-cdn-ali':
        return {
          text: 'Thanks to @CMLiussss',
          url: 'https://github.com/cmliu',
        };
      default:
        return null;
    }
  };


useEffect(() => {
  if (config?.SiteConfig) {
    // 深度合并配置，确保所有层级的默认值都存在
    const deepMerge = (defaults: any, newConfig: any): any => {
      const merged = { ...defaults };
      for (const key in newConfig) {
        if (newConfig[key] !== undefined && newConfig[key] !== null) {
          if (
            typeof newConfig[key] === 'object' &&
            !Array.isArray(newConfig[key]) &&
            defaults[key] &&
            typeof defaults[key] === 'object'
          ) {
            merged[key] = deepMerge(defaults[key], newConfig[key]);
          } else {
            merged[key] = newConfig[key];
          }
        }
      }
      return merged;
    };

    setSiteSettings((prevSettings) => {
      // 步骤 1: 深度合并，处理所有 ?? 逻辑
      const newConfig = deepMerge(prevSettings, config.SiteConfig);
      
      // 步骤 2: 处理密钥占位符
      const newOptions = newConfig.IntelligentFilter.options;
      const prevOptions = prevSettings.IntelligentFilter.options;
      
      if (newOptions.sightengine?.apiSecret === '********' && prevOptions.sightengine?.apiSecret) {
        newOptions.sightengine.apiSecret = prevOptions.sightengine.apiSecret;
      }
      if (newOptions.custom?.apiKeyValue === '********' && prevOptions.custom?.apiKeyValue) {
        newOptions.custom.apiKeyValue = prevOptions.custom.apiKeyValue;
      }
      if (newOptions.baidu?.secretKey === '********' && prevOptions.baidu?.secretKey) {
        newOptions.baidu.secretKey = prevOptions.baidu.secretKey;
      }
      if (newOptions.aliyun?.accessKeySecret === '********' && prevOptions.aliyun?.accessKeySecret) {
        newOptions.aliyun.accessKeySecret = prevOptions.aliyun.accessKeySecret;
      }
      if (newOptions.tencent?.secretKey === '********' && prevOptions.tencent?.secretKey) {
        newOptions.tencent.secretKey = prevOptions.tencent.secretKey;
      }

      // 步骤 3: 处理需要 || 逻辑的字段
      const fieldsWithFalsyDefaults = {
        DoubanProxyType: 'cmliussss-cdn-tencent',
        DoubanImageProxyType: 'cmliussss-cdn-tencent',
        DoubanProxy: '',
        DoubanImageProxy: '',
	DisableYellowFilter: false,
      };
      
      for (const [field, defaultValue] of Object.entries(fieldsWithFalsyDefaults)) {
        // 使用这个判断条件来正确模拟 || 的行为
        if (!newConfig[field]) {
          // 特殊处理布尔值 false，因为 !false 是 true
          if (newConfig[field] === false) continue;
          newConfig[field] = defaultValue;
        }
      }
      
      return newConfig;
    });
  }
}, [config]);


  // 点击外部区域关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDoubanDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('[data-dropdown="douban-datasource"]')) {
          setIsDoubanDropdownOpen(false);
        }
      }
    };

    if (isDoubanDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDoubanDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDoubanImageProxyDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('[data-dropdown="douban-image-proxy"]')) {
          setIsDoubanImageProxyDropdownOpen(false);
        }
      }
    };

    if (isDoubanImageProxyDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDoubanImageProxyDropdownOpen]);
  // 新增：当审核配置变化时，重置验证状态
  useEffect(() => {
    setIsApiVerified(false);
    setApiTestResult(null);
  }, [
    siteSettings.IntelligentFilter?.provider,
    siteSettings.IntelligentFilter?.options.custom?.apiUrl,
    siteSettings.IntelligentFilter?.options.custom?.apiKeyHeader,
    siteSettings.IntelligentFilter?.options.custom?.apiKeyValue,
    siteSettings.IntelligentFilter?.options.custom?.jsonBodyTemplate,
    siteSettings.IntelligentFilter?.options.custom?.responseScorePath,
    siteSettings.IntelligentFilter?.options.sightengine?.apiUrl,
    siteSettings.IntelligentFilter?.options.sightengine?.apiUser,
    siteSettings.IntelligentFilter?.options.sightengine?.apiSecret,
    siteSettings.IntelligentFilter?.options.baidu?.apiKey,
    siteSettings.IntelligentFilter?.options.baidu?.secretKey,
    siteSettings.IntelligentFilter?.options.baidu?.tokenUrl,
  ]);
  
  // 处理豆瓣数据源变化
  const handleDoubanDataSourceChange = (value: string) => {
    setSiteSettings((prev) => ({
      ...prev,
      DoubanProxyType: value,
    }));
  };

  // 处理豆瓣图片代理变化
  const handleDoubanImageProxyChange = (value: string) => {
    setSiteSettings((prev) => ({
      ...prev,
      DoubanImageProxyType: value,
    }));
  };
  // 测试API连接的函数（已修改为通用）
  const handleTestApiConnection = async () => {
    const provider = siteSettings.IntelligentFilter?.provider;
    if (!provider) return;

    // 根据当前选择的 provider 动态获取对应的配置
    const config = siteSettings.IntelligentFilter.options[provider];

    if (!config) {
      showAlert({ type: 'error', title: '错误', message: '找不到API配置' });
      return;
    }

    setIsApiTesting(true);
    setApiTestResult(null);
    try {
      // 向同一个后端接口发送请求，但增加了 provider 字段以作区分
      const response = await fetch('/api/admin/moderate/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider, // <--- 关键改动：告知后端当前测试的是哪个提供商
          config: config,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || '测试请求失败');
      }
      setApiTestResult({ success: true, message: result.message });
      setIsApiVerified(true); // 测试通过
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setApiTestResult({ success: false, message });
      setIsApiVerified(false); // 测试失败
    } finally {
      setIsApiTesting(false);
    }
  };
  // 保存站点配置
  const handleSave = async () => {
    // 在保存前，先对数据进行处理
    const settingsToSave = JSON.parse(JSON.stringify(siteSettings));
    await withLoading('saveSiteConfig', async () => {
      try {
        const resp = await fetch('/api/admin/site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settingsToSave),
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || `保存失败: ${resp.status}`);
        }

        showSuccess('保存成功, 请刷新页面', showAlert);
        await refreshConfig();
      } catch (err) {
        showError(err instanceof Error ? err.message : '保存失败', showAlert);
        throw err;
      }
    });
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载中...
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 站点名称 */}
      <div>
        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          站点名称
        </label>
        <input
          type='text'
          value={siteSettings.SiteName}
          onChange={(e) =>
            setSiteSettings((prev) => ({ ...prev, SiteName: e.target.value }))
          }
          className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
        />
      </div>

      {/* 站点公告 */}
      <div>
        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          站点公告
        </label>
        <textarea
          value={siteSettings.Announcement}
          onChange={(e) =>
            setSiteSettings((prev) => ({
              ...prev,
              Announcement: e.target.value,
            }))
          }
          rows={3}
          className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
        />
      </div>

      {/* 豆瓣数据源设置 */}
      <div className='space-y-3'>
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            豆瓣数据代理
          </label>
          <div className='relative' data-dropdown='douban-datasource'>
            {/* 自定义下拉选择框 */}
            <button
              type='button'
              onClick={() => setIsDoubanDropdownOpen(!isDoubanDropdownOpen)}
              className='w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm hover:border-gray-400 dark:hover:border-gray-500 text-left'
            >
              {
                doubanDataSourceOptions.find(
                  (option) => option.value === siteSettings.DoubanProxyType
                )?.label
              }
            </button>

            {/* 下拉箭头 */}
            <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
                  isDoubanDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </div>

            {/* 下拉选项列表 */}
            {isDoubanDropdownOpen && (
              <div className='absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto'>
                {doubanDataSourceOptions.map((option) => (
                  <button
                    key={option.value}
                    type='button'
                    onClick={() => {
                      handleDoubanDataSourceChange(option.value);
                      setIsDoubanDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      siteSettings.DoubanProxyType === option.value
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    <span className='truncate'>{option.label}</span>
                    {siteSettings.DoubanProxyType === option.value && (
                      <Check className='w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 ml-2' />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            选择获取豆瓣数据的方式
          </p>

          {/* 感谢信息 */}
          {getThanksInfo(siteSettings.DoubanProxyType) && (
            <div className='mt-3'>
              <button
                type='button'
                onClick={() =>
                  window.open(
                    getThanksInfo(siteSettings.DoubanProxyType)!.url,
                    '_blank'
                  )
                }
                className='flex items-center justify-center gap-1.5 w-full px-3 text-xs text-gray-500 dark:text-gray-400 cursor-pointer'
              >
                <span className='font-medium'>
                  {getThanksInfo(siteSettings.DoubanProxyType)!.text}
                </span>
                <ExternalLink className='w-3.5 opacity-70' />
              </button>
            </div>
          )}
        </div>

        {/* 豆瓣代理地址设置 - 仅在选择自定义代理时显示 */}
        {siteSettings.DoubanProxyType === 'custom' && (
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              豆瓣代理地址
            </label>
            <input
              type='text'
              placeholder='例如: https://proxy.example.com/fetch?url='
              value={siteSettings.DoubanProxy}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  DoubanProxy: e.target.value,
                }))
              }
              className='w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 shadow-sm hover:border-gray-400 dark:hover:border-gray-500'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              自定义代理服务器地址
            </p>
          </div>
        )}
      </div>

      {/* 豆瓣图片代理设置 */}
      <div className='space-y-3'>
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            豆瓣图片代理
          </label>
          <div className='relative' data-dropdown='douban-image-proxy'>
            {/* 自定义下拉选择框 */}
            <button
              type='button'
              onClick={() =>
                setIsDoubanImageProxyDropdownOpen(
                  !isDoubanImageProxyDropdownOpen
                )
              }
              className='w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm hover:border-gray-400 dark:hover:border-gray-500 text-left'
            >
              {
                doubanImageProxyTypeOptions.find(
                  (option) => option.value === siteSettings.DoubanImageProxyType
                )?.label
              }
            </button>

            {/* 下拉箭头 */}
            <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
                  isDoubanImageProxyDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </div>

            {/* 下拉选项列表 */}
            {isDoubanImageProxyDropdownOpen && (
              <div className='absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto'>
                {doubanImageProxyTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type='button'
                    onClick={() => {
                      handleDoubanImageProxyChange(option.value);
                      setIsDoubanImageProxyDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      siteSettings.DoubanImageProxyType === option.value
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    <span className='truncate'>{option.label}</span>
                    {siteSettings.DoubanImageProxyType === option.value && (
                      <Check className='w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 ml-2' />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            选择获取豆瓣图片的方式
          </p>

          {/* 感谢信息 */}
          {getThanksInfo(siteSettings.DoubanImageProxyType) && (
            <div className='mt-3'>
              <button
                type='button'
                onClick={() =>
                  window.open(
                    getThanksInfo(siteSettings.DoubanImageProxyType)!.url,
                    '_blank'
                  )
                }
                className='flex items-center justify-center gap-1.5 w-full px-3 text-xs text-gray-500 dark:text-gray-400 cursor-pointer'
              >
                <span className='font-medium'>
                  {getThanksInfo(siteSettings.DoubanImageProxyType)!.text}
                </span>
                <ExternalLink className='w-3.5 opacity-70' />
              </button>
            </div>
          )}
        </div>

        {/* 豆瓣代理地址设置 - 仅在选择自定义代理时显示 */}
        {siteSettings.DoubanImageProxyType === 'custom' && (
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              豆瓣图片代理地址
            </label>
            <input
              type='text'
              placeholder='例如: https://proxy.example.com/fetch?url='
              value={siteSettings.DoubanImageProxy}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  DoubanImageProxy: e.target.value,
                }))
              }
              className='w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 shadow-sm hover:border-gray-400 dark:hover:border-gray-500'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              自定义图片代理服务器地址
            </p>
          </div>
        )}
      </div>

      {/* 搜索接口可拉取最大页数 */}
      <div>
        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          搜索接口可拉取最大页数
        </label>
        <input
          type='number'
          min={1}
          value={siteSettings.SearchDownstreamMaxPage}
          onChange={(e) =>
            setSiteSettings((prev) => ({
              ...prev,
              SearchDownstreamMaxPage: Number(e.target.value),
            }))
          }
          className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
        />
      </div>

      {/* 站点接口缓存时间 */}
      <div>
        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          站点接口缓存时间（秒）
        </label>
        <input
          type='number'
          min={1}
          value={siteSettings.SiteInterfaceCacheTime}
          onChange={(e) =>
            setSiteSettings((prev) => ({
              ...prev,
              SiteInterfaceCacheTime: Number(e.target.value),
            }))
          }
          className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
        />
      </div>

      {/* 禁用黄色过滤器 */}
      <div>
        <div className='flex items-center justify-between'>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            禁用黄色过滤器
          </label>
          <button
            type='button'
            onClick={() =>
              setSiteSettings((prev) => ({
                ...prev,
                DisableYellowFilter: !prev.DisableYellowFilter,
              }))
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
              siteSettings.DisableYellowFilter
                ? buttonStyles.toggleOn
                : buttonStyles.toggleOff
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full ${
                buttonStyles.toggleThumb
              } transition-transform ${
                siteSettings.DisableYellowFilter
                  ? buttonStyles.toggleThumbOn
                  : buttonStyles.toggleThumbOff
              }`}
            />
          </button>
        </div>
        <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
          禁用黄色内容的过滤功能，允许显示所有内容。
        </p>
      </div>
      
      {/* 显示内容安全筛选器 */}
      <div>
        <div className='flex items-center justify-between'>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            显示内容安全筛选器
          </label>
          <button
            type='button'
            onClick={() =>
              setSiteSettings((prev) => ({
                ...prev,
                ShowContentFilter: !(prev.ShowContentFilter ?? true),
              }))
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
              siteSettings.ShowContentFilter !== false
                ? buttonStyles.toggleOn
                : buttonStyles.toggleOff
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full ${
                buttonStyles.toggleThumb
              } transition-transform ${
                siteSettings.ShowContentFilter !== false
                  ? buttonStyles.toggleThumbOn
                  : buttonStyles.toggleThumbOff
              }`}
            />
          </button>
        </div>
        <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
          在搜索结果页面显示“全部/常规/探索内容”的筛选切换按钮。
        </p>
      </div>
      
      {/* 流式搜索 */}
      <div>
        <div className='flex items-center justify-between'>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            启用流式搜索
          </label>
          <button
            type='button'
            onClick={() =>
              setSiteSettings((prev) => ({
                ...prev,
                FluidSearch: !prev.FluidSearch,
              }))
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
              siteSettings.FluidSearch
                ? buttonStyles.toggleOn
                : buttonStyles.toggleOff
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full ${
                buttonStyles.toggleThumb
              } transition-transform ${
                siteSettings.FluidSearch
                  ? buttonStyles.toggleThumbOn
                  : buttonStyles.toggleThumbOff
              }`}
            />
          </button>
        </div>
        <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
          启用后搜索结果将实时流式返回，提升用户体验。
        </p>
      </div>

      {/* 新增：智能内容审核配置 */}
      <div className='border-t border-gray-200 dark:border-gray-700 pt-6 mt-6'>
        <h3 className='text-md font-semibold text-gray-800 dark:text-gray-200 mb-4'>
          智能内容审核
        </h3>
        <div className='space-y-6'>
          {/* 启用开关 */}
          <div>
            <div className='flex items-center justify-between'>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                启用智能审核
              </label>
              <button
                type='button'
                onClick={() => handleIntelligentFilterChange('enabled', !siteSettings.IntelligentFilter?.enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                  siteSettings.IntelligentFilter?.enabled
                    ? buttonStyles.toggleOn
                    : buttonStyles.toggleOff
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full ${
                    buttonStyles.toggleThumb
                  } transition-transform ${
                    siteSettings.IntelligentFilter?.enabled
                      ? buttonStyles.toggleThumbOn
                      : buttonStyles.toggleThumbOff
                  }`}
                />
              </button>
            </div>
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              启用后，将使用第三方AI服务对视频封面图进行审核。
            </p>
          </div>
          {/* 提供商选择 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              审核服务提供商
            </label>
            <select
              value={siteSettings.IntelligentFilter?.provider || 'sightengine'}
              onChange={(e) => handleIntelligentFilterChange('provider', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            >
              <option value='sightengine'>Sightengine (内置支持)</option>
              <option value='baidu'>百度智能云 (内置支持)</option>
              <option value='aliyun'>阿里云 (即将支持)</option>
              <option value='tencent'>腾讯云 (即将支持)</option>
              <option value='custom'>自定义 API</option>
            </select>
          </div>
          {/* Sightengine 配置项 */}
          {siteSettings.IntelligentFilter?.provider === 'sightengine' && (
            <div className='space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50'>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                为 Sightengine 配置 API 凭证。
              </p>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  API URL
                </label>
                <input
                  type='text'
                  value={siteSettings.IntelligentFilter.options.sightengine?.apiUrl || ''}
                  onChange={(e) => handleFilterOptionChange('sightengine', 'apiUrl', e.target.value)}
                  placeholder='留空将使用默认地址: https://api.sightengine.com/'
                  className='w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  API User
                </label>
                <input
                  type='text'
                  placeholder='请输入 Sightengine API User'
                  value={siteSettings.IntelligentFilter.options.sightengine?.apiUser || ''}
                  onChange={(e) => handleFilterOptionChange('sightengine', 'apiUser', e.target.value)}
                  className='w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  API Secret
                </label>
                <input
                  type='password'
                  placeholder='请输入 Sightengine API Secret'
                  value={siteSettings.IntelligentFilter.options.sightengine?.apiSecret || ''}
                  onChange={(e) => handleFilterOptionChange('sightengine', 'apiSecret', e.target.value)}
                  className='w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                />
              </div>
              {/* 超时时间设置 */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  超时时间 (毫秒)
                </label>
                <input
                  type='number'
                  placeholder='默认 15000'
                  value={siteSettings.IntelligentFilter.options.sightengine?.timeoutMs || ''}
                  onChange={(e) => handleFilterOptionChange('sightengine', 'timeoutMs', e.target.value)}
                  className='w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                />
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  设置请求 Sightengine API 的超时时间，单位为毫秒。
                </p>
              </div>              
              {/* 为 Sightengine 添加测试连接按钮和结果显示 */}
              <div className='pt-2'>
                <button
                  type='button'
                  onClick={handleTestApiConnection}
                  disabled={isApiTesting}
                  className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isApiTesting
                      ? buttonStyles.disabled
                      : buttonStyles.primary
                  }`}
                >
                  {isApiTesting ? '测试中...' : '测试连接'}
                </button>
                {apiTestResult && (
                  <div
                    className={`mt-3 p-2 text-xs rounded-md ${
                      apiTestResult.success
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {apiTestResult.message}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* 百度智能云 配置项 */}
          {siteSettings.IntelligentFilter?.provider === 'baidu' && (
            <div className='space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50'>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                为百度智能云内容审核配置凭证。
              </p>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  API Key (Client ID)
                </label>
                <input
                  type='text'
                  placeholder='请输入百度云 API Key'
                  value={siteSettings.IntelligentFilter.options.baidu?.apiKey || ''}
                  onChange={(e) => handleFilterOptionChange('baidu', 'apiKey', e.target.value)}
                  className='w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  Secret Key (Client Secret)
                </label>
                <input
                  type='password'
                  placeholder='请输入百度云 Secret Key'
                  value={siteSettings.IntelligentFilter.options.baidu?.secretKey || ''}
                  onChange={(e) => handleFilterOptionChange('baidu', 'secretKey', e.target.value)}
                  className='w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  Token URL (可选)
                </label>
                <input
                  type='text'
                  placeholder='留空则使用默认地址'
                  value={siteSettings.IntelligentFilter.options.baidu?.tokenUrl || ''}
                  onChange={(e) => handleFilterOptionChange('baidu', 'tokenUrl', e.target.value)}
                  className='w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                />
              </div>
              {/* 新增：超时时间设置 */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  审核请求超时 (毫秒)
                </label>
                <input
                  type='number'
                  placeholder='默认 15000'
                  value={siteSettings.IntelligentFilter.options.baidu?.timeoutMs || ''}
                  onChange={(e) => handleFilterOptionChange('baidu', 'timeoutMs', e.target.value)}
                  className='w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  Token 请求超时 (毫秒)
                </label>
                <input
                  type='number'
                  placeholder='默认 15000'
                  value={siteSettings.IntelligentFilter.options.baidu?.tokenTimeoutMs || ''}
                  onChange={(e) => handleFilterOptionChange('baidu', 'tokenTimeoutMs', e.target.value)}
                  className='w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                />
              </div>              
              {/* 为百度云添加测试连接按钮 */}
              <div className='pt-2'>
                <button
                  type='button'
                  onClick={handleTestApiConnection}
                  disabled={isApiTesting}
                  className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isApiTesting
                      ? buttonStyles.disabled
                      : buttonStyles.primary
                  }`}
                >
                  {isApiTesting ? '测试中...' : '测试连接'}
                </button>
                {apiTestResult && (
                  <div
                    className={`mt-3 p-2 text-xs rounded-md ${
                      apiTestResult.success
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {apiTestResult.message}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* 阿里云 & 腾讯云 (占位) */}
          {(siteSettings.IntelligentFilter?.provider === 'aliyun' || siteSettings.IntelligentFilter?.provider === 'tencent') && (
            <div className='p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-center'>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                {siteSettings.IntelligentFilter.provider === 'aliyun' ? '阿里云' : '腾讯云'} 
                内容安全服务即将支持，敬请期待！
              </p>
            </div>
          )}
          {/* 自定义 API 配置项 */}
          {siteSettings.IntelligentFilter?.provider === 'custom' && (
            <div className='space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50'>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                配置一个通用的 JSON API 进行审核。
              </p>
              <div>
                <label className='block text-sm font-medium'>API URL</label>
                <input type='text' value={siteSettings.IntelligentFilter.options.custom?.apiUrl || ''} onChange={(e) => handleFilterOptionChange('custom', 'apiUrl', e.target.value)} className='w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800' />
              </div>
              <div>
                <label className='block text-sm font-medium'>API Key Header</label>
                <input type='text' placeholder='例如: Authorization' value={siteSettings.IntelligentFilter.options.custom?.apiKeyHeader || ''} onChange={(e) => handleFilterOptionChange('custom', 'apiKeyHeader', e.target.value)} className='w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800' />
              </div>
              <div>
                <label className='block text-sm font-medium'>API Key Value</label>
                <input type='password' placeholder='例如: Bearer sk-xxxx' value={siteSettings.IntelligentFilter.options.custom?.apiKeyValue || ''} onChange={(e) => handleFilterOptionChange('custom', 'apiKeyValue', e.target.value)} className='w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800' />
              </div>
              <div>
                <label className='block text-sm font-medium'>JSON Body Template</label>
                <textarea value={siteSettings.IntelligentFilter.options.custom?.jsonBodyTemplate || ''} onChange={(e) => handleFilterOptionChange('custom', 'jsonBodyTemplate', e.target.value)} className='w-full px-3 py-2 border rounded-lg font-mono text-xs text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800' rows={3}></textarea>
                <p className='text-xs text-gray-500 mt-1'>使用 `{'{{URL}}'}` 作为图片地址的占位符。</p>
              </div>
              {/* 新增: 响应分数路径 */}
              <div>
                <label className='block text-sm font-medium'>Response Score Path</label>
                <input
                  type='text'
                  placeholder='例如: nudity.raw 或 data.score'
                  value={siteSettings.IntelligentFilter.options.custom?.responseScorePath || ''}
                  onChange={(e) => handleFilterOptionChange('custom', 'responseScorePath', e.target.value)}
                  className='w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800'
                />
                <p className='text-xs text-gray-500 mt-1'>
                  指定 API 响应中数字分数的路径。如果分数大于等于置信度阈值，则屏蔽。
                </p>
              </div>
              {/* 新增：测试连接按钮和结果显示 */}
              <div className='pt-2'>
                <button
                  type='button'
                  onClick={handleTestApiConnection}
                  disabled={isApiTesting}
                  className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isApiTesting
                      ? buttonStyles.disabled
                      : buttonStyles.primary
                  }`}
                >
                  {isApiTesting ? '测试中...' : '测试连接'}
                </button>
                {apiTestResult && (
                  <div
                    className={`mt-3 p-2 text-xs rounded-md ${
                      apiTestResult.success
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {apiTestResult.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 通用配置：置信度 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              置信度阈值 (0.0 - 1.0)
            </label>
            <input
              type='number'
              min="0" max="1" step="0.05"
              placeholder='例如: 0.85'
              value={siteSettings.IntelligentFilter?.confidence || 0.85}
              onChange={(e) => handleIntelligentFilterChange('confidence', parseFloat(e.target.value) || 0.85)}
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              当AI模型识别出违规内容的可能性高于此值时，将自动屏蔽。
            </p>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className='flex justify-end'>
        <button
          onClick={handleSave}
          disabled={
            isLoading('saveSiteConfig') ||
            (siteSettings.IntelligentFilter?.enabled && !isApiVerified)
          }
          className={`px-4 py-2 ${
            isLoading('saveSiteConfig') ||
            (siteSettings.IntelligentFilter?.enabled && !isApiVerified)
              ? buttonStyles.disabled
              : buttonStyles.success
          } rounded-lg transition-colors`}
          title={
            siteSettings.IntelligentFilter?.enabled && !isApiVerified
              ? '请先测试并确保API连接通过'
              : ''
          }
        >
          {isLoading('saveSiteConfig') ? '保存中…' : '保存'}
        </button>
      </div>

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

// OAuth 配置组件
const OAuthConfigComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [oauthSettings, setOauthSettings] = useState({
    enabled: false,
    autoRegister: false,
    minTrustLevel: 3,
    defaultRole: 'user' as 'user' | 'admin',
    clientId: '',
    clientSecret: '',
    redirectUri: '',
  });

  // 加载 OAuth 配置
  useEffect(() => {
    if (config?.SiteConfig.LinuxDoOAuth) {
      const oauth = config.SiteConfig.LinuxDoOAuth;
      setOauthSettings({
        enabled: oauth.enabled,
        autoRegister: oauth.autoRegister,
        minTrustLevel: oauth.minTrustLevel,
        defaultRole: oauth.defaultRole,
        clientId: oauth.clientId,
        clientSecret: oauth.clientSecret || '',
        redirectUri: oauth.redirectUri || '',
      });
    }
  }, [config]);

  // 保存 OAuth 配置
  const handleSaveOAuth = async () => {
    await withLoading('saveOAuth', async () => {
      try {
        const response = await fetch('/api/admin/oauth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(oauthSettings),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || '保存失败');
        }

        showAlert({
          type: 'success',
          title: '成功',
          message: 'OAuth 配置已保存',
          timer: 2000,
        });
        await refreshConfig();
      } catch (error) {
        console.error('保存 OAuth 配置失败:', error);
        showAlert({
          type: 'error',
          title: '错误',
          message: '保存配置失败: ' + (error as Error).message,
          showConfirm: true,
        });
        throw error;
      }
    });
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载中...
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
          LinuxDo OAuth 登录配置
        </h3>
        <button
          onClick={handleSaveOAuth}
          disabled={isLoading('saveOAuth')}
          className={
            isLoading('saveOAuth')
              ? buttonStyles.disabled
              : buttonStyles.success
          }
        >
          {isLoading('saveOAuth') ? '保存中...' : '保存配置'}
        </button>
      </div>

      {/* 基础开关 */}
      <div className='space-y-4'>
        <div className='flex items-center space-x-3'>
          <input
            type='checkbox'
            id='oauth-enabled'
            checked={oauthSettings.enabled}
            onChange={(e) =>
              setOauthSettings((prev) => ({
                ...prev,
                enabled: e.target.checked,
              }))
            }
            className='h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded'
          />
          <label
            htmlFor='oauth-enabled'
            className='text-sm font-medium text-gray-700 dark:text-gray-300'
          >
            启用 LinuxDo OAuth 登录
          </label>
        </div>

        <div className='flex items-center space-x-3'>
          <input
            type='checkbox'
            id='oauth-auto-register'
            checked={oauthSettings.autoRegister}
            onChange={(e) =>
              setOauthSettings((prev) => ({
                ...prev,
                autoRegister: e.target.checked,
              }))
            }
            className='h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded'
          />
          <label
            htmlFor='oauth-auto-register'
            className='text-sm font-medium text-gray-700 dark:text-gray-300'
          >
            自动注册新用户
          </label>
        </div>
      </div>

      {/* OAuth 应用配置 */}
      <div className='space-y-4'>
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            应用 ID (Client ID) *
          </label>
          <input
            type='text'
            value={oauthSettings.clientId}
            onChange={(e) =>
              setOauthSettings((prev) => ({
                ...prev,
                clientId: e.target.value,
              }))
            }
            placeholder='LinuxDo OAuth 应用的 Client ID'
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            应用密钥 (Client Secret) *
          </label>
          <input
            type='password'
            value={oauthSettings.clientSecret}
            onChange={(e) =>
              setOauthSettings((prev) => ({
                ...prev,
                clientSecret: e.target.value,
              }))
            }
            placeholder='LinuxDo OAuth 应用的 Client Secret'
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            回调地址 (可选)
          </label>
          <input
            type='url'
            value={oauthSettings.redirectUri}
            onChange={(e) =>
              setOauthSettings((prev) => ({
                ...prev,
                redirectUri: e.target.value,
              }))
            }
            placeholder='留空使用自动生成的回调地址'
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
          />
          <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
            如需自定义回调地址，请确保配置正确
          </p>
        </div>
      </div>

      {/* 用户注册配置 */}
      <div className='space-y-4'>
        <h4 className='text-md font-medium text-gray-900 dark:text-gray-100'>
          用户注册配置
        </h4>

        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            最低信任等级
          </label>
          <select
            value={oauthSettings.minTrustLevel}
            onChange={(e) =>
              setOauthSettings((prev) => ({
                ...prev,
                minTrustLevel: parseInt(e.target.value),
              }))
            }
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
          >
            <option value={0}>0 级 - 新用户</option>
            <option value={1}>1 级 - 基础用户</option>
            <option value={2}>2 级 - 会员</option>
            <option value={3}>3 级 - 常规用户</option>
            <option value={4}>4 级 - 领导者</option>
          </select>
          <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
            只有达到此等级的 LinuxDo 用户才能登录
          </p>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            默认用户角色
          </label>
          <select
            value={oauthSettings.defaultRole}
            onChange={(e) =>
              setOauthSettings((prev) => ({
                ...prev,
                defaultRole: e.target.value as 'user' | 'admin',
              }))
            }
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
          >
            <option value='user'>普通用户</option>
            <option value='admin'>管理员</option>
          </select>
          <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
            自动注册的用户将获得此角色
          </p>
        </div>
      </div>

      {/* 配置说明 */}
      <div className='bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg'>
        <h5 className='text-sm font-medium text-blue-800 dark:text-blue-200 mb-2'>
          配置说明
        </h5>
        <ul className='text-xs text-blue-700 dark:text-blue-300 space-y-1'>
          <li>• 需要在 LinuxDo 管理后台创建 OAuth 应用获取凭证</li>
          <li>• 启用自动注册后，符合信任等级的新用户将自动创建账号</li>
          <li>• 禁用自动注册时，只有已存在的用户可以登录</li>
          <li>• 回调地址格式: https://yourdomain.com/api/oauth/callback</li>
        </ul>
      </div>

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

// 直播源配置组件
const LiveSourceConfig = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [liveSources, setLiveSources] = useState<LiveDataSource[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLiveSource, setEditingLiveSource] =
    useState<LiveDataSource | null>(null);
  const [orderChanged, setOrderChanged] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newLiveSource, setNewLiveSource] = useState<LiveDataSource>({
    name: '',
    key: '',
    url: '',
    ua: '',
    epg: '',
    disabled: false,
    from: 'custom',
  });

  // dnd-kit 传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 轻微位移即可触发
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 长按 150ms 后触发，避免与滚动冲突
        tolerance: 5,
      },
    })
  );

  // 初始化
  useEffect(() => {
    if (config?.LiveConfig) {
      setLiveSources(config.LiveConfig);
      // 进入时重置 orderChanged
      setOrderChanged(false);
    }
  }, [config]);

  // 通用 API 请求
  const callLiveSourceApi = async (body: Record<string, any>) => {
    try {
      const resp = await fetch('/api/admin/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${resp.status}`);
      }

      // 成功后刷新配置
      await refreshConfig();
    } catch (err) {
      showError(err instanceof Error ? err.message : '操作失败', showAlert);
      throw err; // 向上抛出方便调用处判断
    }
  };

  const handleToggleEnable = (key: string) => {
    const target = liveSources.find((s) => s.key === key);
    if (!target) return;
    const action = target.disabled ? 'enable' : 'disable';
    withLoading(`toggleLiveSource_${key}`, () =>
      callLiveSourceApi({ action, key })
    ).catch(() => {
      console.error('操作失败', action, key);
    });
  };

  const handleDelete = (key: string) => {
    withLoading(`deleteLiveSource_${key}`, () =>
      callLiveSourceApi({ action: 'delete', key })
    ).catch(() => {
      console.error('操作失败', 'delete', key);
    });
  };

  // 刷新直播源
  const handleRefreshLiveSources = async () => {
    if (isRefreshing) return;

    await withLoading('refreshLiveSources', async () => {
      setIsRefreshing(true);
      try {
        const response = await fetch('/api/admin/live/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `刷新失败: ${response.status}`);
        }

        // 刷新成功后重新获取配置
        await refreshConfig();
        showAlert({
          type: 'success',
          title: '刷新成功',
          message: '直播源已刷新',
          timer: 2000,
        });
      } catch (err) {
        showError(err instanceof Error ? err.message : '刷新失败', showAlert);
        throw err;
      } finally {
        setIsRefreshing(false);
      }
    });
  };

  const handleAddLiveSource = () => {
    if (!newLiveSource.name || !newLiveSource.key || !newLiveSource.url) return;
    withLoading('addLiveSource', async () => {
      await callLiveSourceApi({
        action: 'add',
        key: newLiveSource.key,
        name: newLiveSource.name,
        url: newLiveSource.url,
        ua: newLiveSource.ua,
        epg: newLiveSource.epg,
      });
      setNewLiveSource({
        name: '',
        key: '',
        url: '',
        epg: '',
        ua: '',
        disabled: false,
        from: 'custom',
      });
      setShowAddForm(false);
    }).catch(() => {
      console.error('操作失败', 'add', newLiveSource);
    });
  };

  const handleEditLiveSource = () => {
    if (!editingLiveSource || !editingLiveSource.name || !editingLiveSource.url)
      return;
    withLoading('editLiveSource', async () => {
      await callLiveSourceApi({
        action: 'edit',
        key: editingLiveSource.key,
        name: editingLiveSource.name,
        url: editingLiveSource.url,
        ua: editingLiveSource.ua,
        epg: editingLiveSource.epg,
      });
      setEditingLiveSource(null);
    }).catch(() => {
      console.error('操作失败', 'edit', editingLiveSource);
    });
  };

  const handleCancelEdit = () => {
    setEditingLiveSource(null);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = liveSources.findIndex((s) => s.key === active.id);
    const newIndex = liveSources.findIndex((s) => s.key === over.id);
    setLiveSources((prev) => arrayMove(prev, oldIndex, newIndex));
    setOrderChanged(true);
  };

  const handleSaveOrder = () => {
    const order = liveSources.map((s) => s.key);
    withLoading('saveLiveSourceOrder', () =>
      callLiveSourceApi({ action: 'sort', order })
    )
      .then(() => {
        setOrderChanged(false);
      })
      .catch(() => {
        console.error('操作失败', 'sort', order);
      });
  };

  // 可拖拽行封装 (dnd-kit)
  const DraggableRow = ({ liveSource }: { liveSource: LiveDataSource }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: liveSource.key });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    } as React.CSSProperties;

    return (
      <tr
        ref={setNodeRef}
        style={style}
        className='hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors select-none'
      >
        <td
          className='px-2 py-4 cursor-grab text-gray-400'
          style={{ touchAction: 'none' }}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
          {liveSource.name}
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
          {liveSource.key}
        </td>
        <td
          className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 max-w-[12rem] truncate'
          title={liveSource.url}
        >
          {liveSource.url}
        </td>
        <td
          className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 max-w-[8rem] truncate'
          title={liveSource.epg || '-'}
        >
          {liveSource.epg || '-'}
        </td>
        <td
          className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 max-w-[8rem] truncate'
          title={liveSource.ua || '-'}
        >
          {liveSource.ua || '-'}
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-center'>
          {liveSource.channelNumber && liveSource.channelNumber > 0
            ? liveSource.channelNumber
            : '-'}
        </td>
        <td className='px-6 py-4 whitespace-nowrap max-w-[1rem]'>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              !liveSource.disabled
                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
            }`}
          >
            {!liveSource.disabled ? '启用中' : '已禁用'}
          </span>
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
          <button
            onClick={() => handleToggleEnable(liveSource.key)}
            disabled={isLoading(`toggleLiveSource_${liveSource.key}`)}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
              !liveSource.disabled
                ? buttonStyles.roundedDanger
                : buttonStyles.roundedSuccess
            } transition-colors ${
              isLoading(`toggleLiveSource_${liveSource.key}`)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {!liveSource.disabled ? '禁用' : '启用'}
          </button>
          {liveSource.from !== 'config' && (
            <>
              <button
                onClick={() => setEditingLiveSource(liveSource)}
                disabled={isLoading(`editLiveSource_${liveSource.key}`)}
                className={`${buttonStyles.roundedPrimary} ${
                  isLoading(`editLiveSource_${liveSource.key}`)
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                编辑
              </button>
              <button
                onClick={() => handleDelete(liveSource.key)}
                disabled={isLoading(`deleteLiveSource_${liveSource.key}`)}
                className={`${buttonStyles.roundedSecondary} ${
                  isLoading(`deleteLiveSource_${liveSource.key}`)
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                删除
              </button>
            </>
          )}
        </td>
      </tr>
    );
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载中...
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 添加直播源表单 */}
      <div className='flex items-center justify-between'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
          直播源列表
        </h4>
        <div className='flex items-center space-x-2'>
          <button
            onClick={handleRefreshLiveSources}
            disabled={isRefreshing || isLoading('refreshLiveSources')}
            className={`px-3 py-1.5 text-sm font-medium flex items-center space-x-2 ${
              isRefreshing || isLoading('refreshLiveSources')
                ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white rounded-lg'
                : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg transition-colors'
            }`}
          >
            <span>
              {isRefreshing || isLoading('refreshLiveSources')
                ? '刷新中...'
                : '刷新直播源'}
            </span>
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={
              showAddForm ? buttonStyles.secondary : buttonStyles.success
            }
          >
            {showAddForm ? '取消' : '添加直播源'}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <input
              type='text'
              placeholder='名称'
              value={newLiveSource.name}
              onChange={(e) =>
                setNewLiveSource((prev) => ({ ...prev, name: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='Key'
              value={newLiveSource.key}
              onChange={(e) =>
                setNewLiveSource((prev) => ({ ...prev, key: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='M3U 地址'
              value={newLiveSource.url}
              onChange={(e) =>
                setNewLiveSource((prev) => ({ ...prev, url: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='节目单地址（选填）'
              value={newLiveSource.epg}
              onChange={(e) =>
                setNewLiveSource((prev) => ({ ...prev, epg: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='自定义 UA（选填）'
              value={newLiveSource.ua}
              onChange={(e) =>
                setNewLiveSource((prev) => ({ ...prev, ua: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>
          <div className='flex justify-end'>
            <button
              onClick={handleAddLiveSource}
              disabled={
                !newLiveSource.name ||
                !newLiveSource.key ||
                !newLiveSource.url ||
                isLoading('addLiveSource')
              }
              className={`w-full sm:w-auto px-4 py-2 ${
                !newLiveSource.name ||
                !newLiveSource.key ||
                !newLiveSource.url ||
                isLoading('addLiveSource')
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('addLiveSource') ? '添加中...' : '添加'}
            </button>
          </div>
        </div>
      )}

      {/* 编辑直播源表单 */}
      {editingLiveSource && (
        <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4'>
          <div className='flex items-center justify-between'>
            <h5 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              编辑直播源: {editingLiveSource.name}
            </h5>
            <button
              onClick={handleCancelEdit}
              className='text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            >
              ✕
            </button>
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                名称
              </label>
              <input
                type='text'
                value={editingLiveSource.name}
                onChange={(e) =>
                  setEditingLiveSource((prev) =>
                    prev ? { ...prev, name: e.target.value } : null
                  )
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                Key (不可编辑)
              </label>
              <input
                type='text'
                value={editingLiveSource.key}
                disabled
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                M3U 地址
              </label>
              <input
                type='text'
                value={editingLiveSource.url}
                onChange={(e) =>
                  setEditingLiveSource((prev) =>
                    prev ? { ...prev, url: e.target.value } : null
                  )
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                节目单地址（选填）
              </label>
              <input
                type='text'
                value={editingLiveSource.epg}
                onChange={(e) =>
                  setEditingLiveSource((prev) =>
                    prev ? { ...prev, epg: e.target.value } : null
                  )
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'>
                自定义 UA（选填）
              </label>
              <input
                type='text'
                value={editingLiveSource.ua}
                onChange={(e) =>
                  setEditingLiveSource((prev) =>
                    prev ? { ...prev, ua: e.target.value } : null
                  )
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
          </div>
          <div className='flex justify-end space-x-2'>
            <button
              onClick={handleCancelEdit}
              className={buttonStyles.secondary}
            >
              取消
            </button>
            <button
              onClick={handleEditLiveSource}
              disabled={
                !editingLiveSource.name ||
                !editingLiveSource.url ||
                isLoading('editLiveSource')
              }
              className={`${
                !editingLiveSource.name ||
                !editingLiveSource.url ||
                isLoading('editLiveSource')
                  ? buttonStyles.disabled
                  : buttonStyles.success
              }`}
            >
              {isLoading('editLiveSource') ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}

      {/* 直播源表格 */}
      <div
        className='border border-gray-200 dark:border-gray-700 rounded-lg max-h-[28rem] overflow-y-auto overflow-x-auto relative'
        data-table='live-source-list'
      >
        <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
          <thead className='bg-gray-50 dark:bg-gray-900 sticky top-0 z-10'>
            <tr>
              <th className='w-8' />
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                名称
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                Key
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                M3U 地址
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                节目单地址
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                自定义 UA
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                频道数
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                状态
              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                操作
              </th>
            </tr>
          </thead>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            autoScroll={false}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          >
            <SortableContext
              items={liveSources.map((s) => s.key)}
              strategy={verticalListSortingStrategy}
            >
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {liveSources.map((liveSource) => (
                  <DraggableRow key={liveSource.key} liveSource={liveSource} />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      {/* 保存排序按钮 */}
      {orderChanged && (
        <div className='flex justify-end'>
          <button
            onClick={handleSaveOrder}
            disabled={isLoading('saveLiveSourceOrder')}
            className={`px-3 py-1.5 text-sm ${
              isLoading('saveLiveSourceOrder')
                ? buttonStyles.disabled
                : buttonStyles.primary
            }`}
          >
            {isLoading('saveLiveSourceOrder') ? '保存中...' : '保存排序'}
          </button>
        </div>
      )}

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

function AdminPageClient() {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<'owner' | 'admin' | null>(null);
  const [showResetConfigModal, setShowResetConfigModal] = useState(false);

  // 注册管理相关状态
  const [storageType, setStorageType] = useState<string>('localstorage');
  const [expandedTabs, setExpandedTabs] = useState<{ [key: string]: boolean }>({
    userConfig: false,
    registrationConfig: false,
    videoSource: false,
    liveSource: false,
    siteConfig: false,
    categoryConfig: false,
    configFile: false,
    dataMigration: false,
    oauthConfig: false,
  });

  // 获取管理员配置
  // showLoading 用于控制是否在请求期间显示整体加载骨架。
  const fetchConfig = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const response = await fetch(`/api/admin/config`);

      if (!response.ok) {
        const data = (await response.json()) as any;
        throw new Error(`获取配置失败: ${data.error}`);
      }

      const data = (await response.json()) as AdminConfigResult;
      setConfig(data.Config);
      setRole(data.Role);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '获取配置失败';
      showError(msg, showAlert);
      setError(msg);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // 首次加载时显示骨架
    fetchConfig(true);

    // 获取存储类型
    fetch('/api/server-config')
      .then((res) => res.json())
      .then((data) => {
        setStorageType(data.StorageType || 'localstorage');
      })
      .catch(() => {
        setStorageType('localstorage');
      });
  }, [fetchConfig]);

  // 切换标签展开状态
  const toggleTab = (tabKey: string) => {
    setExpandedTabs((prev) => ({
      ...prev,
      [tabKey]: !prev[tabKey],
    }));
  };

  // 新增: 重置配置处理函数
  const handleResetConfig = () => {
    setShowResetConfigModal(true);
  };

  const handleConfirmResetConfig = async () => {
    await withLoading('resetConfig', async () => {
      try {
        const response = await fetch(`/api/admin/reset`);
        if (!response.ok) {
          throw new Error(`重置失败: ${response.status}`);
        }
        showSuccess('重置成功，请刷新页面！', showAlert);
        await fetchConfig();
        setShowResetConfigModal(false);
      } catch (err) {
        showError(err instanceof Error ? err.message : '重置失败', showAlert);
        throw err;
      }
    });
  };

  if (loading) {
    return (
      <PageLayout activePath='/admin'>
        <div className='px-2 sm:px-10 py-4 sm:py-8'>
          <div className='max-w-[95%] mx-auto'>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8'>
              管理员设置
            </h1>
            <div className='space-y-4'>
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className='h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse'
                />
              ))}
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    // 错误已通过弹窗展示，此处直接返回空
    return null;
  }

  return (
    <PageLayout activePath='/admin'>
      <div className='px-2 sm:px-10 py-4 sm:py-8'>
        <div className='max-w-[95%] mx-auto'>
          {/* 标题 + 重置配置按钮 */}
          <div className='flex items-center gap-2 mb-8'>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
              管理员设置
            </h1>
            {config && role === 'owner' && (
              <button
                onClick={handleResetConfig}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${buttonStyles.dangerSmall}`}
              >
                重置配置
              </button>
            )}
          </div>

          {/* 配置文件标签 - 仅站长可见 */}
          {role === 'owner' && (
            <CollapsibleTab
              title='配置文件'
              icon={
                <FileText
                  size={20}
                  className='text-gray-600 dark:text-gray-400'
                />
              }
              isExpanded={expandedTabs.configFile}
              onToggle={() => toggleTab('configFile')}
            >
              <ConfigFileComponent
                config={config}
                refreshConfig={fetchConfig}
              />
            </CollapsibleTab>
          )}

          {/* 站点配置标签 */}
          <CollapsibleTab
            title='站点配置'
            icon={
              <Settings
                size={20}
                className='text-gray-600 dark:text-gray-400'
              />
            }
            isExpanded={expandedTabs.siteConfig}
            onToggle={() => toggleTab('siteConfig')}
          >
            <SiteConfigComponent config={config} refreshConfig={fetchConfig} />
          </CollapsibleTab>

          {/* OAuth 配置标签 - 仅非 localStorage 模式下显示 */}
          {storageType !== 'localstorage' && (
            <CollapsibleTab
              title='LinuxDo OAuth 配置'
              icon={
                <KeyRound
                  size={20}
                  className='text-gray-600 dark:text-gray-400'
                />
              }
              isExpanded={expandedTabs.oauthConfig}
              onToggle={() => toggleTab('oauthConfig')}
            >
              <OAuthConfigComponent
                config={config}
                refreshConfig={fetchConfig}
              />
            </CollapsibleTab>
          )}

          <div className='space-y-4'>
            {/* 用户配置标签 */}
            <CollapsibleTab
              title='用户配置'
              icon={
                <Users size={20} className='text-gray-600 dark:text-gray-400' />
              }
              isExpanded={expandedTabs.userConfig}
              onToggle={() => toggleTab('userConfig')}
            >
              <UserConfig
                config={config}
                role={role}
                refreshConfig={fetchConfig}
              />
            </CollapsibleTab>

            {/* 注册管理标签 - 仅在非 localStorage 模式下显示 */}
            {storageType !== 'localstorage' && (
              <CollapsibleTab
                title='注册管理'
                icon={
                  <UserCheck
                    size={20}
                    className='text-gray-600 dark:text-gray-400'
                  />
                }
                isExpanded={expandedTabs.registrationConfig}
                onToggle={() => toggleTab('registrationConfig')}
              >
                <RegistrationConfig
                  config={config}
                  role={role}
                  refreshConfig={fetchConfig}
                />
              </CollapsibleTab>
            )}

            {/* 视频源配置标签 */}
            <CollapsibleTab
              title='视频源配置'
              icon={
                <Video size={20} className='text-gray-600 dark:text-gray-400' />
              }
              isExpanded={expandedTabs.videoSource}
              onToggle={() => toggleTab('videoSource')}
            >
              <VideoSourceConfig config={config} refreshConfig={fetchConfig} />
            </CollapsibleTab>

            {/* 直播源配置标签 */}
            <CollapsibleTab
              title='直播源配置'
              icon={
                <Tv size={20} className='text-gray-600 dark:text-gray-400' />
              }
              isExpanded={expandedTabs.liveSource}
              onToggle={() => toggleTab('liveSource')}
            >
              <LiveSourceConfig config={config} refreshConfig={fetchConfig} />
            </CollapsibleTab>

            {/* 分类配置标签 */}
            <CollapsibleTab
              title='分类配置'
              icon={
                <FolderOpen
                  size={20}
                  className='text-gray-600 dark:text-gray-400'
                />
              }
              isExpanded={expandedTabs.categoryConfig}
              onToggle={() => toggleTab('categoryConfig')}
            >
              <CategoryConfig config={config} refreshConfig={fetchConfig} />
            </CollapsibleTab>

            {/* 数据迁移标签 - 仅站长可见 */}
            {role === 'owner' && (
              <CollapsibleTab
                title='数据迁移'
                icon={
                  <Database
                    size={20}
                    className='text-gray-600 dark:text-gray-400'
                  />
                }
                isExpanded={expandedTabs.dataMigration}
                onToggle={() => toggleTab('dataMigration')}
              >
                <DataMigration onRefreshConfig={fetchConfig} />
              </CollapsibleTab>
            )}
          </div>
        </div>
      </div>

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />

      {/* 重置配置确认弹窗 */}
      {showResetConfigModal &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => setShowResetConfigModal(false)}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    确认重置配置
                  </h3>
                  <button
                    onClick={() => setShowResetConfigModal(false)}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='mb-6'>
                  <div className='bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <svg
                        className='w-5 h-5 text-yellow-600 dark:text-yellow-400'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                        />
                      </svg>
                      <span className='text-sm font-medium text-yellow-800 dark:text-yellow-300'>
                        ⚠️ 危险操作警告
                      </span>
                    </div>
                    <p className='text-sm text-yellow-700 dark:text-yellow-400'>
                      此操作将重置用户封禁和管理员设置、自定义视频源，站点配置将重置为默认值，是否继续？
                    </p>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={() => setShowResetConfigModal(false)}
                    className={`px-6 py-2.5 text-sm font-medium ${buttonStyles.secondary}`}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmResetConfig}
                    disabled={isLoading('resetConfig')}
                    className={`px-6 py-2.5 text-sm font-medium ${
                      isLoading('resetConfig')
                        ? buttonStyles.disabled
                        : buttonStyles.danger
                    }`}
                  >
                    {isLoading('resetConfig') ? '重置中...' : '确认重置'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </PageLayout>
  );
}

export default function AdminPage() {
  return (
    <Suspense>
      <AdminPageClient />
    </Suspense>
  );
}

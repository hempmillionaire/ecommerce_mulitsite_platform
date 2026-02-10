import { supabase } from './supabase';
import type { UserRole } from './database.types';

export interface CustomAuthUser {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  status: string;
  emailVerified: boolean;
  lastLoginAt: string | null;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  fullName?: string;
}

export interface AuthAuditEvent {
  userId?: string;
  eventType: string;
  description?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  performedBy?: string;
}

export class CustomAuthService {
  private static SESSION_DURATION_HOURS = 24 * 7;

  static async hashPassword(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  static generateSalt(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  static generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  static async signup(data: SignupData): Promise<{ user: CustomAuthUser; session: AuthSession } | null> {
    try {
      const { data: existingUser } = await supabase
        .from('auth_users')
        .select('id')
        .eq('email', data.email.toLowerCase())
        .maybeSingle();

      if (existingUser) {
        throw new Error('User already exists');
      }

      const { data: newUser, error: userError } = await supabase
        .from('auth_users')
        .insert({
          email: data.email.toLowerCase(),
          full_name: data.fullName || null,
          status: 'active',
        })
        .select()
        .single();

      if (userError) throw userError;

      const salt = this.generateSalt();
      const passwordHash = await this.hashPassword(data.password, salt);

      const { error: credError } = await supabase
        .from('auth_credentials')
        .insert({
          user_id: newUser.id,
          password_hash: passwordHash,
          password_salt: salt,
        });

      if (credError) throw credError;

      const { error: roleError } = await supabase
        .from('auth_role_assignments')
        .insert({
          user_id: newUser.id,
          role: 'retail',
          is_current: true,
        });

      if (roleError) throw roleError;

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: newUser.id,
          email: newUser.email,
          full_name: data.fullName || null,
          role: 'retail',
          auth_user_id: newUser.id,
        })
        .select()
        .single();

      if (profileError) throw profileError;

      await this.logAuditEvent({
        userId: newUser.id,
        eventType: 'signup',
        description: 'User account created',
      });

      const session = await this.createSession(newUser.id);

      return {
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.full_name,
          role: 'retail',
          status: newUser.status,
          emailVerified: newUser.email_verified,
          lastLoginAt: newUser.last_login_at,
        },
        session: session!,
      };
    } catch (error) {
      console.error('Signup error:', error);
      return null;
    }
  }

  static async login(credentials: LoginCredentials): Promise<{ user: CustomAuthUser; session: AuthSession } | null> {
    try {
      const { data: user } = await supabase
        .from('auth_users')
        .select('*')
        .eq('email', credentials.email.toLowerCase())
        .eq('status', 'active')
        .maybeSingle();

      if (!user) {
        await this.logAuditEvent({
          eventType: 'login_failed',
          description: `Failed login attempt for ${credentials.email}`,
          metadata: { reason: 'user_not_found' },
        });
        return null;
      }

      const { data: cred } = await supabase
        .from('auth_credentials')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!cred) return null;

      if (cred.locked_until && new Date(cred.locked_until) > new Date()) {
        await this.logAuditEvent({
          userId: user.id,
          eventType: 'login_failed',
          description: 'Login attempt on locked account',
          metadata: { reason: 'account_locked' },
        });
        return null;
      }

      const passwordHash = await this.hashPassword(credentials.password, cred.password_salt);

      if (passwordHash !== cred.password_hash) {
        await supabase
          .from('auth_credentials')
          .update({ failed_attempts: cred.failed_attempts + 1 })
          .eq('id', cred.id);

        await this.logAuditEvent({
          userId: user.id,
          eventType: 'login_failed',
          description: 'Invalid password',
          metadata: { attempts: cred.failed_attempts + 1 },
        });

        return null;
      }

      await supabase
        .from('auth_credentials')
        .update({ failed_attempts: 0 })
        .eq('id', cred.id);

      await supabase
        .from('auth_users')
        .update({
          last_login_at: new Date().toISOString(),
          login_count: user.login_count + 1,
        })
        .eq('id', user.id);

      const { data: roleAssignment } = await supabase
        .from('auth_role_assignments')
        .select('role')
        .eq('user_id', user.id)
        .eq('is_current', true)
        .eq('revoked', false)
        .maybeSingle();

      const role = roleAssignment?.role || 'guest';

      await this.logAuditEvent({
        userId: user.id,
        eventType: 'login',
        description: 'User logged in successfully',
      });

      const session = await this.createSession(user.id);

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: role as UserRole,
          status: user.status,
          emailVerified: user.email_verified,
          lastLoginAt: user.last_login_at,
        },
        session: session!,
      };
    } catch (error) {
      console.error('Login error:', error);
      return null;
    }
  }

  static async logout(token: string): Promise<boolean> {
    try {
      const { data: session } = await supabase
        .from('auth_sessions')
        .select('user_id')
        .eq('token', token)
        .maybeSingle();

      if (!session) return false;

      await supabase
        .from('auth_sessions')
        .update({
          revoked: true,
          revoked_at: new Date().toISOString(),
          revoked_reason: 'User logout',
        })
        .eq('token', token);

      await this.logAuditEvent({
        userId: session.user_id,
        eventType: 'logout',
        description: 'User logged out',
      });

      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  static async validateSession(token: string): Promise<CustomAuthUser | null> {
    try {
      const { data: session } = await supabase
        .from('auth_sessions')
        .select('*')
        .eq('token', token)
        .eq('revoked', false)
        .maybeSingle();

      if (!session) return null;

      if (new Date(session.expires_at) < new Date()) {
        return null;
      }

      await supabase
        .from('auth_sessions')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', session.id);

      const { data: user } = await supabase
        .from('auth_users')
        .select('*')
        .eq('id', session.user_id)
        .eq('status', 'active')
        .maybeSingle();

      if (!user) return null;

      const { data: roleAssignment } = await supabase
        .from('auth_role_assignments')
        .select('role')
        .eq('user_id', user.id)
        .eq('is_current', true)
        .eq('revoked', false)
        .maybeSingle();

      const role = roleAssignment?.role || 'guest';

      return {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: role as UserRole,
        status: user.status,
        emailVerified: user.email_verified,
        lastLoginAt: user.last_login_at,
      };
    } catch (error) {
      console.error('Session validation error:', error);
      return null;
    }
  }

  private static async createSession(userId: string): Promise<AuthSession | null> {
    try {
      const token = this.generateToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.SESSION_DURATION_HOURS);

      const { data: session, error } = await supabase
        .from('auth_sessions')
        .insert({
          user_id: userId,
          token,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      await this.logAuditEvent({
        userId,
        eventType: 'session_created',
        description: 'New session created',
      });

      return {
        id: session.id,
        userId: session.user_id,
        token: session.token,
        expiresAt: session.expires_at,
      };
    } catch (error) {
      console.error('Session creation error:', error);
      return null;
    }
  }

  static async changeRole(
    userId: string,
    newRole: UserRole,
    performedBy: string,
    reason?: string
  ): Promise<boolean> {
    try {
      await supabase
        .from('auth_role_assignments')
        .update({
          is_current: false,
          revoked: true,
          revoked_by: performedBy,
          revoked_at: new Date().toISOString(),
          revoked_reason: `Role changed to ${newRole}`,
        })
        .eq('user_id', userId)
        .eq('is_current', true);

      await supabase
        .from('auth_role_assignments')
        .insert({
          user_id: userId,
          role: newRole,
          assigned_by: performedBy,
          assigned_reason: reason,
          is_current: true,
        });

      await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId);

      await this.logAuditEvent({
        userId,
        eventType: 'role_changed',
        description: `Role changed to ${newRole}`,
        metadata: { newRole, reason },
        performedBy,
      });

      return true;
    } catch (error) {
      console.error('Role change error:', error);
      return false;
    }
  }

  static async logAuditEvent(event: AuthAuditEvent): Promise<void> {
    try {
      await supabase.from('auth_audit_log').insert({
        user_id: event.userId || null,
        event_type: event.eventType,
        description: event.description || null,
        metadata: event.metadata || {},
        ip_address: event.ipAddress || null,
        user_agent: event.userAgent || null,
        performed_by: event.performedBy || null,
      });
    } catch (error) {
      console.error('Audit log error:', error);
    }
  }
}

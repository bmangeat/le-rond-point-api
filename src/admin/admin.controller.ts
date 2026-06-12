import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsEmail, IsEnum, IsOptional } from 'class-validator';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GroupAccessGuard } from '../common/guards/group-access.guard';
import { GroupAdminGuard } from '../common/guards/group-admin.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

class InviteEmailDto {
  @IsEmail() email: string;
}

class ModerateCommentDto {
  @IsString() commentId: string;
  @IsEnum(['delete', 'dismiss']) op: 'delete' | 'dismiss';
}

@Controller('groups/:groupId/admin')
@UseGuards(JwtAuthGuard, GroupAccessGuard, GroupAdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  // GET /api/groups/:groupId/admin/invitations
  @Get('invitations')
  listInvitations(@Param('groupId') groupId: string) {
    return this.adminService.listPendingInvitations(groupId);
  }

  // POST /api/groups/:groupId/admin/invite
  @Post('invite')
  inviteByEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: InviteEmailDto,
  ) {
    return this.adminService.inviteByEmail(user.id, groupId, dto.email);
  }

  // POST /api/groups/:groupId/admin/invite/link
  @Post('invite/link')
  generateLink(@Param('groupId') groupId: string) {
    return this.adminService.generateInviteLink(groupId);
  }

  // DELETE /api/groups/:groupId/admin/invitations/:id
  @Delete('invitations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteInvitation(@Param('groupId') groupId: string, @Param('id') id: string) {
    return this.adminService.deleteInvitation(groupId, id);
  }

  // GET /api/groups/:groupId/admin/reports
  @Get('reports')
  getReports(@Param('groupId') groupId: string) {
    return this.adminService.getReportedComments(groupId);
  }

  // POST /api/groups/:groupId/admin/reports
  @Post('reports')
  @HttpCode(HttpStatus.OK)
  moderateComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: ModerateCommentDto,
  ) {
    if (dto.op === 'delete') {
      return this.adminService.deleteReportedComment(
        dto.commentId,
        user.id,
        user.email,
        groupId,
      );
    }
    return this.adminService.dismissReports(dto.commentId);
  }
}

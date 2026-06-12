import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GroupAccessGuard } from '../common/guards/group-access.guard';
import { GroupAdminGuard } from '../common/guards/group-admin.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CurrentMembership } from '../common/decorators/current-membership.decorator';
import {
  CreateGroupDto,
  UpdateGroupDto,
  UpdateMembershipDto,
  UpdateMemberRoleDto,
} from './dto/groups.dto';
import { GroupMembership, GroupRole } from '@prisma/client';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  // GET /api/groups — liste mes groupes
  @Get()
  findMyGroups(@CurrentUser() user: AuthenticatedUser) {
    return this.groupsService.findMyGroups(user.id);
  }

  // POST /api/groups — créer un groupe
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(user.id, dto.name);
  }

  // GET /api/groups/:groupId — détail d'un groupe
  @Get(':groupId')
  @UseGuards(GroupAccessGuard)
  findOne(@Param('groupId') groupId: string) {
    return this.groupsService.findOne(groupId);
  }

  // PATCH /api/groups/:groupId — renommer le groupe (admin)
  @Patch(':groupId')
  @UseGuards(GroupAccessGuard, GroupAdminGuard)
  rename(@Param('groupId') groupId: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.rename(groupId, dto.name);
  }

  // PATCH /api/groups/:groupId/members/me — modifier ma membership (isResident)
  @Patch(':groupId/members/me')
  @UseGuards(GroupAccessGuard)
  updateMyMembership(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    return this.groupsService.updateMyMembership(user.id, groupId, dto);
  }

  // DELETE /api/groups/:groupId/members/me — quitter un groupe
  @Delete(':groupId/members/me')
  @UseGuards(GroupAccessGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  leaveGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
  ) {
    return this.groupsService.leaveGroup(user.id, groupId);
  }

  // PATCH /api/groups/:groupId/members/:userId — changer le rôle (admin)
  @Patch(':groupId/members/:userId')
  @UseGuards(GroupAccessGuard, GroupAdminGuard)
  updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.groupsService.updateMemberRole(
      user.id,
      groupId,
      targetUserId,
      dto.role as GroupRole,
    );
  }

  // DELETE /api/groups/:groupId/members/:userId — retirer un membre (admin)
  @Delete(':groupId/members/:userId')
  @UseGuards(GroupAccessGuard, GroupAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.groupsService.removeMember(user.id, groupId, targetUserId);
  }
}

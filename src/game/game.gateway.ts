import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'game',
})
export class GameGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;

  constructor(private readonly gameService: GameService) {}

  handleConnection(client: Socket) {
    console.log(`New connection: ${client.id}`);
  }

  @SubscribeMessage('join_game')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
  ) {
    client.join(data.gameId);
    client.emit('timer_state', this.gameService.getPublicState(data.gameId));
  }

  @SubscribeMessage('admin:start_question')
  handleStart(@MessageBody() data: { gameId: string }) {
    this.gameService.startQuestion(data.gameId, 60, (state) => {
      this.server.to(data.gameId).emit('timer_state', state);
    });
  }

  @SubscribeMessage('admin:pause')
  handlePause(@MessageBody() data: { gameId: string }) {
    const state = this.gameService.pauseTimer(data.gameId);
    this.server.to(data.gameId).emit('timer_state', state);
  }

  @SubscribeMessage('admin:resume')
  handleResume(@MessageBody() data: { gameId: string }) {
    this.gameService.resumeTimer(data.gameId, (state) => {
      this.server.to(data.gameId).emit('timer_state', state);
    });
  }

  @SubscribeMessage('admin:adjust')
  handleAdjust(@MessageBody() data: { gameId: string; seconds: number }) {
    const state = this.gameService.adjustTimer(data.gameId, data.seconds);

    if (state) {
      this.server.to(data.gameId).emit('timer_state', state);
    }
  }
}

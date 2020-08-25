/// <reference path="./config.ts" />
var chat;
(function (chat) {
    var Mode;
    (function (Mode) {
        Mode[Mode["Sfu"] = 1] = "Sfu";
        Mode[Mode["Mcu"] = 2] = "Mcu";
        Mode[Mode["Peer"] = 3] = "Peer";
    })(Mode = chat.Mode || (chat.Mode = {}));
    var App = /** @class */ (function () {
        function App(logContainer) {
            this.channel = null;
            this.mcuConnection = null;
            this.sfuDownstreamConnections = {};
            this.peerConnections = {};
            this.localMedia = null;
            this.layoutManager = null;
            this.videoLayout = null;
            this.audioOnly = false;
            this.receiveOnly = false;
            this.simulcast = false;
            // Track whether the user has decided to leave (unregister)
            // If they have not and the client gets into the Disconnected state then we attempt to reregister (reconnect) automatically.
            this.unRegistering = false;
            this.reRegisterBackoff = 200;
            this.maxRegisterBackoff = 60000;
            this.applicationId = 'my-app-id';
            this.channelId = null; // set by index.ts
            this.userId = fm.liveswitch.Guid.newGuid().toString().replace(/-/g, '');
            this.deviceId = fm.liveswitch.Guid.newGuid().toString().replace(/-/g, '');
            this.userName = null;
            this.mcuViewId = null;
            this.dataChannelsSupported = true;
            this.opusDisabled = false;
            this.g722Disabled = false;
            this.pcmuDisabled = false;
            this.pcmaDisabled = false;
            this.vp8Disabled = false;
            this.vp9Disabled = false;
            this.h264Disabled = false;
            this.client = null;
            this.dataChannels = [];
            this.videoHeight = 480;
            this.videoWidth = 640;
            this.videoFps = 30;
            this.chromeExtensionInstallButton = document.getElementById('chromeExtensionInstallButton');
            // Log to console and the DOM.
            fm.liveswitch.Log.registerProvider(new fm.liveswitch.ConsoleLogProvider(fm.liveswitch.LogLevel.Debug));
            fm.liveswitch.Log.registerProvider(new fm.liveswitch.DomLogProvider(logContainer, fm.liveswitch.LogLevel.Debug));
        }
        App.prototype.setUserName = function (userName) {
            this.userName = userName;
        };
        App.prototype.startLocalMedia = function (videoContainer, captureScreen, audioOnly, receiveOnly, simulcast, audioDeviceList, videoDeviceList, receiveEncodingsGroup) {
            var _this = this;
            var promise = new fm.liveswitch.Promise();
            try {
                if (this.localMedia != null) {
                    throw new Error("Local media has already been started.");
                }
                this.audioOnly = audioOnly;
                this.receiveOnly = receiveOnly;
                this.simulcast = simulcast;
                this.receiveEncodingsGroup = receiveEncodingsGroup;
                var pluginConfig = new fm.liveswitch.PluginConfig();
                pluginConfig.setActiveXPath("./FM.LiveSwitch.ActiveX.cab");
                fm.liveswitch.Plugin.install(pluginConfig).then(function (result) {
                    // Check if this browser is supported with local media (if not receive-only).
                    if (!fm.liveswitch.Plugin.isReady(!_this.receiveOnly)) {
                        // Check if this browser is supported without local media.
                        if (fm.liveswitch.Plugin.isReady()) {
                            promise.reject(new Error('This browser supports WebRTC, but does not support media capture.\nTry receive-only mode!'));
                        }
                        else {
                            promise.reject(new Error('This browser does not support WebRTC, and no plugin could be found.'));
                        }
                        return;
                    }
                    // Set up the layout manager.
                    _this.layoutManager = new fm.liveswitch.DomLayoutManager(videoContainer);
                    // Set up the local media.
                    var audio = true;
                    if (audioDeviceList) {
                        audioDeviceList.options.length = 0;
                    }
                    if (videoDeviceList) {
                        videoDeviceList.options.length = 0;
                    }
                    if (_this.receiveEncodingsGroup) {
                        _this.receiveEncodingsGroup.style.visibility = "collapse";
                    }
                    if (!_this.receiveOnly) {
                        if (!_this.audioOnly) {
                            var video = captureScreen ? new fm.liveswitch.VideoConfig(window.screen.width, window.screen.height, 3) : new fm.liveswitch.VideoConfig(_this.videoWidth, _this.videoHeight, _this.videoFps);
                            _this.localMedia = new fm.liveswitch.LocalMedia(audio, video, captureScreen);
                            if (_this.simulcast) {
                                var videoEncodings = [];
                                videoEncodings.push(new fm.liveswitch.VideoEncodingConfig());
                                videoEncodings.push(new fm.liveswitch.VideoEncodingConfig());
                                videoEncodings.push(new fm.liveswitch.VideoEncodingConfig());
                                videoEncodings[0].setBitrate(1024);
                                videoEncodings[0].setFrameRate(captureScreen ? 3 : 30);
                                videoEncodings[1].setBitrate(512);
                                videoEncodings[1].setFrameRate(captureScreen ? 2 : 15);
                                videoEncodings[1].setScale(0.5);
                                videoEncodings[2].setBitrate(256);
                                videoEncodings[2].setFrameRate(captureScreen ? 1 : 7.5);
                                videoEncodings[2].setScale(0.25);
                                _this.localMedia.setVideoEncodings(videoEncodings);
                            }
                        }
                        else {
                            _this.localMedia = new fm.liveswitch.LocalMedia(audio, null, captureScreen);
                        }
                        // Start the local media.
                        _this.localMedia.start().then(function (o) {
                            // Audio device selection.
                            if (audioDeviceList) {
                                audioDeviceList.options.length = 0;
                                var currentAudioSourceInput_1 = _this.localMedia.getAudioSourceInput();
                                _this.localMedia.getAudioSourceInputs().then(function (inputs) {
                                    for (var _i = 0, inputs_1 = inputs; _i < inputs_1.length; _i++) {
                                        var input = inputs_1[_i];
                                        var option = document.createElement('option');
                                        option.value = input.getId();
                                        option.text = input.getName();
                                        option.selected = (currentAudioSourceInput_1 != null && currentAudioSourceInput_1.getId() == input.getId());
                                        audioDeviceList.add(option);
                                    }
                                });
                            }
                            // Video device selection.
                            if (videoDeviceList) {
                                videoDeviceList.options.length = 0;
                                if (!audioOnly && !captureScreen) {
                                    var currentVideoSourceInput_1 = _this.localMedia.getVideoSourceInput();
                                    _this.localMedia.getVideoSourceInputs().then(function (inputs) {
                                        for (var _i = 0, inputs_2 = inputs; _i < inputs_2.length; _i++) {
                                            var input = inputs_2[_i];
                                            var option = document.createElement('option');
                                            option.value = input.getId();
                                            option.text = input.getName();
                                            option.selected = (currentVideoSourceInput_1 != null && currentVideoSourceInput_1.getId() == input.getId());
                                            videoDeviceList.add(option);
                                        }
                                    });
                                }
                            }
                            if (!audioOnly) {
                                var localView = _this.localMedia.getView();
                                if (localView != null) {
                                    localView.id = 'localView';
                                    _this.layoutManager.setLocalView(localView);
                                }
                            }
                            promise.resolve(null);
                        }, function (ex) {
                            if (audioOnly) {
                                promise.reject(ex);
                            }
                            else if (captureScreen && fm.liveswitch.Plugin.getChromeExtensionRequired() && !fm.liveswitch.Plugin.getChromeExtensionInstalled()) {
                                _this.chromeExtensionInstallButton.removeAttribute('class');
                                promise.reject(new Error(ex + '\n\nClick "Install Screen-Sharing Extension" to install screen-sharing extension.'));
                            }
                            else if (captureScreen) {
                                promise.reject(ex);
                            }
                            else {
                                // Try with a static image since a camera may not be available.
                                var canvas_1 = document.getElementById('localCanvasSource');
                                var canvasFrameRate_1 = 3;
                                if (!canvas_1) {
                                    // Create the canvas if it doesn't exist yet.
                                    canvas_1 = document.createElement('canvas');
                                    canvas_1.id = 'localCanvasSource';
                                    canvas_1.style.position = 'absolute';
                                    document.body.appendChild(canvas_1);
                                    // Load a static image.
                                    var image_1 = new Image();
                                    image_1.onload = function () {
                                        // Resize the canvas to match the image size.
                                        canvas_1.width = image_1.width;
                                        canvas_1.height = image_1.height;
                                        canvas_1.style.left = '-' + image_1.width + 'px';
                                        canvas_1.style.top = '-' + image_1.height + 'px';
                                        // Draw the initial image.
                                        var context = canvas_1.getContext('2d');
                                        context.drawImage(image_1, 0, 0, image_1.width, image_1.height, 0, 0, canvas_1.width, canvas_1.height);
                                        // Refresh the image on a regular interval.
                                        window.setInterval(function () {
                                            context.clearRect(0, 0, canvas_1.width, canvas_1.height);
                                            context.drawImage(image_1, 0, 0, image_1.width, image_1.height, 0, 0, canvas_1.width, canvas_1.height);
                                        }, 1000.0 / canvasFrameRate_1);
                                    };
                                    image_1.src = 'images/static.jpg';
                                }
                                // try local media with stream
                                var canvasStream = canvas_1.captureStream(canvasFrameRate_1);
                                _this.localMedia = new fm.liveswitch.LocalMedia(audio, canvasStream, false);
                                _this.localMedia.start().then(function (o) {
                                    var localView = _this.localMedia.getView();
                                    if (localView != null) {
                                        _this.layoutManager.setLocalView(localView);
                                    }
                                    promise.resolve(null);
                                }, function (ex) {
                                    promise.reject(ex);
                                });
                            }
                        });
                    }
                    else {
                        // Handle Safari permissions handling bug when it is receive-only
                        if (fm.liveswitch.Util.isSafari()) {
                            _this.localMedia = new fm.liveswitch.LocalMedia(true, false);
                            _this.localMedia.start().then(function (lm) {
                                if (fm.liveswitch.Util.isiOS()) {
                                    // Safari iOS requires local media access to play audio
                                    // Audio will not be sent to remote clients but muting the mic as a precautionary measure
                                    lm.setAudioMuted(true);
                                    promise.resolve(null);
                                }
                                else {
                                    // Safari (not iOS) requires to start then stop the local media to play audio
                                    lm.stop().then(function (x) {
                                        // Tear down the local media.
                                        if (this.localMedia != null) {
                                            this.localMedia.destroy();
                                            this.localMedia = null;
                                        }
                                        promise.resolve(null);
                                    }, function (ex) {
                                        promise.reject(ex);
                                    });
                                }
                            }, function (ex) {
                                promise.reject(ex);
                            });
                        }
                        else {
                            promise.resolve(null);
                        }
                    }
                    ;
                }, function (ex) {
                    promise.reject(ex);
                });
            }
            catch (ex) {
                promise.reject(ex);
            }
            return promise;
        };
        App.prototype.stopLocalMedia = function () {
            var _this = this;
            var promise = new fm.liveswitch.Promise();
            try {
                if (this.localMedia == null) {
                    promise.resolve(null);
                    return promise;
                }
                this.localMedia.stop().then(function (o) {
                    // Tear down the layout manager.
                    var lm = _this.layoutManager;
                    if (lm != null) {
                        lm.removeRemoteViews();
                        lm.unsetLocalView();
                        _this.layoutManager = null;
                    }
                    // Tear down the local media.
                    if (_this.localMedia != null) {
                        _this.localMedia.destroy();
                        _this.localMedia = null;
                    }
                    promise.resolve(null);
                }, function (ex) {
                    promise.reject(ex);
                });
            }
            catch (ex) {
                promise.reject(ex);
            }
            return promise;
        };
        ;
        App.prototype.sendMessage = function (text) {
            var channel = this.channel;
            if (channel != null) { // If the registration has not completed, then "channel" will be null. So we want register and then send a message.
                channel.sendMessage(text);
            }
        };
        // Generate a joinAsync token.
        // WARNING: do NOT do this here!
        // Tokens should be generated by a secure server that
        // has authenticated your user identity and is authorized
        // to allow you to joinAsync with the LiveSwitch server.
        App.prototype._generateToken = function (claims) {
            var region = chat.Config.getRegion();
            if (region) {
                return fm.liveswitch.Token.generateClientRegisterToken(this.applicationId, this.client.getUserId(), this.client.getDeviceId(), this.client.getId(), null, claims, chat.Config.getSharedSecret(), region);
            }
            else {
                return fm.liveswitch.Token.generateClientRegisterToken(this.applicationId, this.client.getUserId(), this.client.getDeviceId(), this.client.getId(), null, claims, chat.Config.getSharedSecret());
            }
        };
        App.prototype.joinAsync = function (incomingMessage, peerLeft, peerJoined, clientRegistered) {
            var _this = this;
            var promise = new fm.liveswitch.Promise();
            this.unRegistering = false;
            // Create a client to manage the channel.
            this.client = new fm.liveswitch.Client(chat.Config.getGatewayUrl(), this.applicationId, this.userId, this.deviceId);
            var claims = [new fm.liveswitch.ChannelClaim(this.channelId)];
            // Use the optional tag field to indicate our mode.
            this.client.setTag(this.mode.toString());
            this.client.setUserAlias(this.userName);
            var token = this._generateToken(claims);
            this.client.addOnStateChange(function (client) {
                if (client.getState() == fm.liveswitch.ClientState.Registering) {
                    fm.liveswitch.Log.debug("client is registering");
                }
                else if (client.getState() == fm.liveswitch.ClientState.Registered) {
                    fm.liveswitch.Log.debug("client is registered");
                }
                else if (client.getState() == fm.liveswitch.ClientState.Unregistering) {
                    fm.liveswitch.Log.debug("client is unregistering");
                }
                else if (client.getState() == fm.liveswitch.ClientState.Unregistered) {
                    fm.liveswitch.Log.debug("client is unregistered");
                    // Client has failed for some reason:
                    // We do not need to `c.closeAll()` as the client handled this for us as part of unregistering.
                    if (!_this.unRegistering) {
                        var self_1 = _this;
                        setTimeout(function () {
                            // Back off our reregister attempts as they continue to fail to avoid runaway process.
                            if (self_1.reRegisterBackoff < self_1.maxRegisterBackoff) {
                                self_1.reRegisterBackoff += self_1.reRegisterBackoff;
                            }
                            // ReRegister
                            token = self_1._generateToken(claims);
                            self_1.client.register(token).then(function (channels) {
                                self_1.reRegisterBackoff = 200; // reset for next time
                                self_1.onClientRegistered(channels, incomingMessage, peerLeft, peerJoined, clientRegistered);
                            }, function (ex) {
                                fm.liveswitch.Log.error("Failed to register with Gateway.");
                                promise.reject(ex);
                            });
                        }, _this.reRegisterBackoff);
                    }
                }
            });
            // Register with the server.
            this.client.register(token).then(function (channels) {
                _this.onClientRegistered(channels, incomingMessage, peerLeft, peerJoined, clientRegistered);
                promise.resolve(null);
            }, function (ex) {
                fm.liveswitch.Log.error("Failed to register with Gateway.");
                promise.reject(ex);
            });
            return promise;
        };
        App.prototype.onClientRegistered = function (channels, incomingMessage, peerLeft, peerJoined, clientRegistered) {
            var _this = this;
            this.channel = channels[0];
            // Monitor the channel remote client changes.
            this.channel.addOnRemoteClientJoin(function (remoteClientInfo) {
                fm.liveswitch.Log.info('Remote client joined the channel (client ID: ' +
                    remoteClientInfo.getId() + ', device ID: ' + remoteClientInfo.getDeviceId() +
                    ', user ID: ' + remoteClientInfo.getUserId() + ', tag: ' + remoteClientInfo.getTag() + ').');
                var n = remoteClientInfo.getUserAlias() != null ? remoteClientInfo.getUserAlias() : remoteClientInfo.getUserId();
                peerJoined(n);
            });
            this.channel.addOnRemoteClientLeave(function (remoteClientInfo) {
                var n = remoteClientInfo.getUserAlias() != null ? remoteClientInfo.getUserAlias() : remoteClientInfo.getUserId();
                peerLeft(n);
                fm.liveswitch.Log.info('Remote client left the channel (client ID: ' + remoteClientInfo.getId() +
                    ', device ID: ' + remoteClientInfo.getDeviceId() + ', user ID: ' + remoteClientInfo.getUserId() +
                    ', tag: ' + remoteClientInfo.getTag() + ').');
            });
            // Monitor the channel remote upstream connection changes.
            this.channel.addOnRemoteUpstreamConnectionOpen(function (remoteConnectionInfo) {
                fm.liveswitch.Log.info('Remote client opened upstream connection (connection ID: ' +
                    remoteConnectionInfo.getId() + ', client ID: ' + remoteConnectionInfo.getClientId() + ', device ID: ' +
                    remoteConnectionInfo.getDeviceId() + ', user ID: ' + remoteConnectionInfo.getUserId() + ', tag: ' +
                    remoteConnectionInfo.getTag() + ').');
                if (_this.mode == Mode.Sfu) {
                    // Open downstream connection to receive the new upstream connection.
                    _this.openSfuDownstreamConnection(remoteConnectionInfo);
                }
            });
            this.channel.addOnRemoteUpstreamConnectionClose(function (remoteConnectionInfo) {
                fm.liveswitch.Log.info('Remote client closed upstream connection (connection ID: ' + remoteConnectionInfo.getId() +
                    ', client ID: ' + remoteConnectionInfo.getClientId() + ', device ID: ' + remoteConnectionInfo.getDeviceId() +
                    ', user ID: ' + remoteConnectionInfo.getUserId() + ', tag: ' + remoteConnectionInfo.getTag() + ').');
            });
            // Monitor the channel peer connection offers.
            this.channel.addOnPeerConnectionOffer(function (peerConnectionOffer) {
                // Accept the peer connection offer.
                _this.openPeerAnswerConnection(peerConnectionOffer);
            });
            this.channel.addOnMessage(function (client, message) {
                if (incomingMessage == null)
                    return;
                var n = client.getUserAlias() != null ? client.getUserAlias() : client.getUserId();
                incomingMessage(n, message);
            });
            if (this.mode == Mode.Mcu) {
                // Monitor the channel video layout changes.
                this.channel.addOnMcuVideoLayout(function (videoLayout) {
                    if (!_this.receiveOnly) {
                        _this.videoLayout = videoLayout;
                        // Force a layout in case the local video preview needs to move.
                        var lm = _this.layoutManager;
                        if (lm != null) {
                            lm.layout();
                        }
                    }
                });
                // Open an MCU connection.
                this.openMcuConnection();
            }
            else if (this.mode == Mode.Sfu) {
                if (!this.receiveOnly) {
                    // Open an upstream SFU connection.
                    this.openSfuUpstreamConnection();
                }
                // Open a downstream SFU connection for each remote upstream connection.
                for (var _i = 0, _a = this.channel.getRemoteUpstreamConnectionInfos(); _i < _a.length; _i++) {
                    var remoteConnectionInfo = _a[_i];
                    this.openSfuDownstreamConnection(remoteConnectionInfo);
                }
            }
            else if (this.mode == Mode.Peer) {
                // Open a peer connection for each remote client.
                for (var _b = 0, _c = this.channel.getRemoteClientInfos(); _b < _c.length; _b++) {
                    var remoteClientInfo = _c[_b];
                    this.openPeerOfferConnection(remoteClientInfo);
                }
            }
            clientRegistered();
            if (!this.dataChannelsSupported) {
                incomingMessage("System", "DataChannels not supported by browser");
            }
        };
        App.prototype.leaveAsync = function (clientUnregistered) {
            this.dataChannelConnected = false;
            if (this.client != null) {
                this.unRegistering = true;
                // Unregister with the server.
                return this.client.unregister().then(function () {
                    clientUnregistered();
                }).fail(function () {
                    fm.liveswitch.Log.debug("Failed to unregister client.");
                });
            }
            else {
                return fm.liveswitch.Promise.resolveNow(null);
            }
        };
        App.prototype.openMcuConnection = function (tag) {
            var _this = this;
            // Create remote media to manage incoming media.
            var remoteMedia = new fm.liveswitch.RemoteMedia();
            remoteMedia.setAudioMuted(false);
            remoteMedia.setVideoMuted(this.audioOnly);
            this.mcuViewId = remoteMedia.getId();
            // Add the remote video view to the layout.
            if (remoteMedia.getView()) {
                remoteMedia.getView().id = 'remoteView_' + remoteMedia.getId();
            }
            this.layoutManager.addRemoteView(remoteMedia.getId(), remoteMedia.getView());
            var connection;
            var dataChannel = null;
            var dataStream = null;
            if (this.dataChannelsSupported) {
                dataChannel = this.prepareDataChannel();
                dataStream = new fm.liveswitch.DataStream(dataChannel);
                this.dataChannels.push(dataChannel);
            }
            var audioStream = new fm.liveswitch.AudioStream(this.localMedia, remoteMedia);
            if (this.receiveOnly) {
                audioStream.setLocalDirection(fm.liveswitch.StreamDirection.ReceiveOnly);
            }
            if (this.audioOnly) {
                connection = this.channel.createMcuConnection(audioStream, dataStream);
            }
            else {
                var videoStream = new fm.liveswitch.VideoStream(this.localMedia, remoteMedia);
                if (this.receiveOnly) {
                    videoStream.setLocalDirection(fm.liveswitch.StreamDirection.ReceiveOnly);
                }
                else if (this.simulcast && !this.audioOnly) {
                    videoStream.setSimulcastMode(fm.liveswitch.SimulcastMode.RtpStreamId);
                }
                connection = this.channel.createMcuConnection(audioStream, videoStream, dataStream);
            }
            this.prepareConnection(connection);
            this.mcuConnection = connection;
            // Tag the connection (optional).
            if (tag == null) {
                tag = 'mcu';
            }
            connection.setTag(tag);
            /*
            Embedded TURN servers are used by default.  For more information refer to:
            https://help.frozenmountain.com/docs/liveswitch/server/advanced-topics#TURNintheMediaServer
            */
            // Monitor the connection state changes.
            connection.addOnStateChange(function (connection) {
                fm.liveswitch.Log.info(connection.getId() + ': MCU connection state is ' + new fm.liveswitch.ConnectionStateWrapper(connection.getState()).toString() + '.');
                // Cleanup if the connection closes or fails.
                if (connection.getState() == fm.liveswitch.ConnectionState.Closing || connection.getState() == fm.liveswitch.ConnectionState.Failing) {
                    if (connection.getRemoteClosed()) {
                        fm.liveswitch.Log.info(connection.getId() + ': Media server closed the connection.');
                    }
                    // Remove the remote view from the layout.
                    var lm = _this.layoutManager;
                    if (lm != null) {
                        lm.removeRemoteView(remoteMedia.getId());
                    }
                    remoteMedia.destroy();
                    _this.mcuConnection = null;
                    _this.logConnectionState(connection, "MCU");
                    if (_this.dataChannelsSupported) {
                        _this.dataChannels = _this.dataChannels.filter(function (element) { return element !== dataChannel; });
                    }
                }
                else if (connection.getState() == fm.liveswitch.ConnectionState.Failed) {
                    // Note: no need to close the connection as it's done for us.
                    _this.openMcuConnection(tag);
                    _this.logConnectionState(connection, "MCU");
                }
                else if (connection.getState() == fm.liveswitch.ConnectionState.Connected) {
                    _this.logConnectionState(connection, "MCU");
                }
            });
            // Float the local preview over the mixed video feed for an improved user experience.
            this.layoutManager.addOnLayout(function (layout) {
                if (_this.mcuConnection != null && !_this.receiveOnly && !_this.audioOnly) {
                    fm.liveswitch.LayoutUtility.floatLocalPreview(layout, _this.videoLayout, _this.mcuConnection.getId(), _this.mcuViewId, _this.localMedia.getVideoSink());
                }
            });
            // Open the connection.
            connection.open();
            return connection;
        };
        App.prototype.openSfuUpstreamConnection = function (tag) {
            var _this = this;
            var connection;
            var dataChannel = null;
            var dataStream = null;
            if (this.dataChannelsSupported) {
                dataChannel = this.prepareDataChannel();
                dataStream = new fm.liveswitch.DataStream(dataChannel);
                this.dataChannels.push(dataChannel);
            }
            var audioStream;
            var videoStream;
            if (this.localMedia.getAudioTrack() != null) {
                audioStream = new fm.liveswitch.AudioStream(this.localMedia);
            }
            if (this.localMedia.getVideoTrack() != null) {
                videoStream = new fm.liveswitch.VideoStream(this.localMedia);
                if (this.simulcast) {
                    videoStream.setSimulcastMode(fm.liveswitch.SimulcastMode.RtpStreamId);
                }
            }
            connection = this.channel.createSfuUpstreamConnection(audioStream, videoStream, dataStream);
            this.prepareConnection(connection);
            // Tag the connection (optional).
            if (tag == null) {
                tag = 'sfu-upstream';
            }
            connection.setTag(tag);
            /*
            Embedded TURN servers are used by default.  For more information refer to:
            https://help.frozenmountain.com/docs/liveswitch/server/advanced-topics#TURNintheMediaServer
            */
            // Monitor the connection state changes.
            connection.addOnStateChange(function (connection) {
                fm.liveswitch.Log.info(connection.getId() + ': SFU upstream connection state is ' +
                    new fm.liveswitch.ConnectionStateWrapper(connection.getState()).toString() + '.');
                // Cleanup if the connection closes or fails.
                if (connection.getState() == fm.liveswitch.ConnectionState.Closing ||
                    connection.getState() == fm.liveswitch.ConnectionState.Failing) {
                    if (connection.getRemoteClosed()) {
                        fm.liveswitch.Log.info(connection.getId() + ': Media server closed the connection.');
                    }
                    _this.logConnectionState(connection, "SFU Upstream");
                    if (_this.dataChannelsSupported) {
                        _this.dataChannels = _this.dataChannels.filter(function (element) { return element !== dataChannel; });
                    }
                }
                else if (connection.getState() == fm.liveswitch.ConnectionState.Failed) {
                    // Note: no need to close the connection as it's done for us.
                    _this.openSfuUpstreamConnection(tag);
                    _this.logConnectionState(connection, "SFU Upstream");
                }
                else if (connection.getState() == fm.liveswitch.ConnectionState.Connected) {
                    _this.logConnectionState(connection, "SFU Upstream");
                }
            });
            // Open the connection.
            connection.open();
            return connection;
        };
        App.prototype.openSfuDownstreamConnection = function (remoteConnectionInfo, tag) {
            var _this = this;
            // Create remote media to manage incoming media.
            var remoteMedia = new fm.liveswitch.RemoteMedia();
            remoteMedia.setAudioMuted(false);
            remoteMedia.setVideoMuted(this.audioOnly);
            // Add the remote video view to the layout.
            if (remoteMedia.getView()) {
                remoteMedia.getView().id = 'remoteView_' + remoteMedia.getId();
            }
            this.layoutManager.addRemoteView(remoteMedia.getId(), remoteMedia.getView());
            var connection;
            var dataChannel;
            var dataStream;
            if (this.dataChannelsSupported && remoteConnectionInfo.getHasData() != null) {
                dataChannel = this.prepareDataChannel();
                dataStream = new fm.liveswitch.DataStream(dataChannel);
            }
            var audioStream;
            var videoStream;
            if (remoteConnectionInfo.getHasAudio()) {
                audioStream = new fm.liveswitch.AudioStream(remoteMedia);
            }
            if (remoteConnectionInfo.getHasVideo() && !this.audioOnly) {
                videoStream = new fm.liveswitch.VideoStream(remoteMedia);
                var encodings = remoteConnectionInfo.getVideoStream().getSendEncodings();
                if (encodings && encodings.length > 1) {
                    this.receiveEncodingsGroup.style.visibility = "visible";
                    for (var encoding in encodings) {
                        fm.liveswitch.Log.debug("Remote encoding: " + encoding.toString());
                    }
                    videoStream.setRemoteEncoding(encodings[0]);
                }
            }
            connection = this.channel.createSfuDownstreamConnection(remoteConnectionInfo, audioStream, videoStream, dataStream);
            this.prepareConnection(connection);
            this.sfuDownstreamConnections[connection.getId()] = connection;
            // Tag the connection (optional).
            if (tag == null) {
                tag = 'sfu-downstream';
            }
            connection.setTag(tag);
            /*
            Embedded TURN servers are used by default.  For more information refer to:
            https://help.frozenmountain.com/docs/liveswitch/server/advanced-topics#TURNintheMediaServer
            */
            // Monitor the connection state changes.
            connection.addOnStateChange(function (connection) {
                fm.liveswitch.Log.info(connection.getId() + ': SFU downstream connection state is ' +
                    new fm.liveswitch.ConnectionStateWrapper(connection.getState()).toString() + '.');
                // Cleanup if the connection closes or fails.
                if (connection.getState() == fm.liveswitch.ConnectionState.Closing ||
                    connection.getState() == fm.liveswitch.ConnectionState.Failing) {
                    if (connection.getRemoteClosed()) {
                        fm.liveswitch.Log.info(connection.getId() + ': Media server closed the connection.');
                    }
                    // Remove the remote view from the layout.
                    var lm = _this.layoutManager;
                    if (lm != null) {
                        lm.removeRemoteView(remoteMedia.getId());
                    }
                    remoteMedia.destroy();
                    _this.logConnectionState(connection, "SFU Downstream");
                    delete _this.sfuDownstreamConnections[connection.getId()];
                }
                else if (connection.getState() == fm.liveswitch.ConnectionState.Failed) {
                    // Note: no need to close the connection as it's done for us.
                    _this.openSfuDownstreamConnection(remoteConnectionInfo, tag);
                    _this.logConnectionState(connection, "SFU Downstream");
                }
                else if (connection.getState() == fm.liveswitch.ConnectionState.Connected) {
                    _this.logConnectionState(connection, "SFU Downstream");
                }
            });
            // Open the connection.
            connection.open();
            return connection;
        };
        App.prototype.openPeerOfferConnection = function (remoteClientInfo, tag) {
            var _this = this;
            // Create remote media to manage incoming media.
            var remoteMedia = new fm.liveswitch.RemoteMedia();
            remoteMedia.setAudioMuted(false);
            remoteMedia.setVideoMuted(this.audioOnly);
            // Add the remote video view to the layout.
            if (remoteMedia.getView()) {
                remoteMedia.getView().id = 'remoteView_' + remoteMedia.getId();
            }
            this.layoutManager.addRemoteView(remoteMedia.getId(), remoteMedia.getView());
            var connection;
            var audioStream = new fm.liveswitch.AudioStream(this.localMedia, remoteMedia);
            var videoStream;
            if (!this.audioOnly) {
                videoStream = new fm.liveswitch.VideoStream(this.localMedia, remoteMedia);
            }
            //Please note that DataStreams can also be added to Peer-to-peer connections.
            //Nevertheless, since peer connections do not connect to the media server, there may arise
            //incompatibilities with the peers that do not support DataStream (e.g. Microsoft Edge browser:
            //https://developer.microsoft.com/en-us/microsoft-edge/platform/status/rtcdatachannels/?filter=f3f0000bf&search=rtc&q=data%20channels).
            //For a solution around this issue and complete documentation visit:
            //https://help.frozenmountain.com/docs/liveswitch1/working-with-datachannels
            connection = this.channel.createPeerConnection(remoteClientInfo, audioStream, videoStream);
            this.prepareConnection(connection);
            this.peerConnections[connection.getId()] = connection;
            // Tag the connection (optional).
            if (tag == null) {
                tag = 'peer-offer';
            }
            connection.setTag(tag);
            /*
            Embedded TURN servers are used by default.  For more information refer to:
            https://help.frozenmountain.com/docs/liveswitch/server/advanced-topics#TURNintheMediaServer
            */
            // Monitor the connection state changes.
            connection.addOnStateChange(function (connection) {
                fm.liveswitch.Log.info(connection.getId() + ': Peer connection state is ' +
                    new fm.liveswitch.ConnectionStateWrapper(connection.getState()).toString() + '.');
                // Cleanup if the connection closes or fails.
                if (connection.getState() == fm.liveswitch.ConnectionState.Closing ||
                    connection.getState() == fm.liveswitch.ConnectionState.Failing) {
                    if (connection.getRemoteRejected()) {
                        fm.liveswitch.Log.info(connection.getId() + ': Remote peer rejected the offer.');
                    }
                    else if (connection.getRemoteClosed()) {
                        fm.liveswitch.Log.info(connection.getId() + ': Remote peer closed the connection.');
                    }
                    // Remove the remote view from the layout.
                    var lm = _this.layoutManager;
                    if (lm != null) {
                        lm.removeRemoteView(remoteMedia.getId());
                    }
                    remoteMedia.destroy();
                    delete _this.peerConnections[connection.getId()];
                    _this.logConnectionState(connection, "Peer");
                }
                else if (connection.getState() == fm.liveswitch.ConnectionState.Failed) {
                    // Note: no need to close the connection as it's done for us.
                    _this.openPeerOfferConnection(remoteClientInfo, tag);
                    _this.logConnectionState(connection, "Peer");
                }
                else if (connection.getState() == fm.liveswitch.ConnectionState.Connected) {
                    _this.logConnectionState(connection, "Peer");
                }
            });
            // Open the connection (sends an offer to the remote peer).
            connection.open();
            return connection;
        };
        App.prototype.openPeerAnswerConnection = function (peerConnectionOffer, tag) {
            var _this = this;
            // Create remote media to manage incoming media.
            var remoteMedia = new fm.liveswitch.RemoteMedia();
            remoteMedia.setAudioMuted(false);
            remoteMedia.setVideoMuted(this.audioOnly);
            // Add the remote video view to the layout.
            if (remoteMedia.getView()) {
                remoteMedia.getView().id = 'remoteView_' + remoteMedia.getId();
            }
            this.layoutManager.addRemoteView(remoteMedia.getId(), remoteMedia.getView());
            var connection;
            var audioStream;
            var videoStream;
            if (peerConnectionOffer.getHasAudio()) {
                audioStream = new fm.liveswitch.AudioStream(this.localMedia, remoteMedia);
            }
            if (peerConnectionOffer.getHasVideo()) {
                videoStream = new fm.liveswitch.VideoStream(this.localMedia, remoteMedia);
                if (this.audioOnly) {
                    videoStream.setLocalDirection(fm.liveswitch.StreamDirection.Inactive);
                }
            }
            //Please note that DataStreams can also be added to Peer-to-peer connections.
            //Nevertheless, since peer connections do not connect to the media server, there may arise
            //incompatibilities with the peers that do not support DataStream (e.g. Microsoft Edge browser:
            //https://developer.microsoft.com/en-us/microsoft-edge/platform/status/rtcdatachannels/?filter=f3f0000bf&search=rtc&q=data%20channels).
            //For a solution around this issue and complete documentation visit:
            //https://help.frozenmountain.com/docs/liveswitch1/working-with-datachannels
            connection = this.channel.createPeerConnection(peerConnectionOffer, audioStream, videoStream);
            this.prepareConnection(connection);
            this.peerConnections[connection.getId()] = connection;
            // Tag the connection (optional).
            if (tag == null) {
                tag = 'peer-answer';
            }
            connection.setTag(tag);
            /*
            Embedded TURN servers are used by default.  For more information refer to:
            https://help.frozenmountain.com/docs/liveswitch/server/advanced-topics#TURNintheMediaServer
            */
            // Monitor the connection state changes.
            connection.addOnStateChange(function (connection) {
                fm.liveswitch.Log.info(connection.getId() + ': Peer connection state is ' +
                    new fm.liveswitch.ConnectionStateWrapper(connection.getState()).toString() + '.');
                // Cleanup if the connection closes or fails.
                if (connection.getState() == fm.liveswitch.ConnectionState.Closing ||
                    connection.getState() == fm.liveswitch.ConnectionState.Failing) {
                    if (connection.getRemoteClosed()) {
                        fm.liveswitch.Log.info(connection.getId() + ': Remote peer closed the connection.');
                    }
                    // Remove the remote view from the layout.
                    var lm = _this.layoutManager;
                    if (lm != null) {
                        lm.removeRemoteView(remoteMedia.getId());
                    }
                    remoteMedia.destroy();
                    _this.logConnectionState(connection, "Peer");
                    delete _this.peerConnections[connection.getId()];
                }
                else if (connection.getState() == fm.liveswitch.ConnectionState.Failed) {
                    // Note: no need to close the connection as it's done for us.
                    // Note: do not offer a new answer here. Let the offerer reoffer and then we answer normally.
                    _this.logConnectionState(connection, "Peer");
                }
                else if (connection.getState() == fm.liveswitch.ConnectionState.Connected) {
                    _this.logConnectionState(connection, "Peer");
                }
            });
            // Open the connection (sends an answer to the remote peer).
            connection.open();
            return connection;
        };
        App.prototype.logConnectionState = function (connection, connectionType) {
            var streams = "";
            var streamCount = 0;
            if (connection.getAudioStream() != null) {
                streamCount++;
                streams = "audio";
            }
            if (connection.getDataStream() != null) {
                if (streams.length > 0) {
                    streams += "/";
                }
                streamCount++;
                streams += "data";
            }
            if (connection.getVideoStream() != null) {
                if (streams.length > 0) {
                    streams += "/";
                }
                streamCount++;
                streams += "video";
            }
            if (streamCount > 1) {
                streams += " streams.";
            }
            else {
                streams += " stream";
            }
            if (connection.getState() == fm.liveswitch.ConnectionState.Connected) {
                this.incomingMessage("System", connectionType + " connection connected with " + streams);
            }
            else if (connection.getState() == fm.liveswitch.ConnectionState.Closing) {
                this.incomingMessage("System", connectionType + " connnection closing for " + streams);
            }
            else if (connection.getState() == fm.liveswitch.ConnectionState.Failing) {
                var eventString = connectionType + " connection failing for " + streams;
                if (connection.getError() != null) {
                    eventString += connection.getError().getDescription();
                }
                this.incomingMessage("System", eventString);
            }
            else if (connection.getState() == fm.liveswitch.ConnectionState.Closed) {
                this.incomingMessage("System", connectionType + " connection closed for " + streams);
            }
            else if (connection.getState() == fm.liveswitch.ConnectionState.Failed) {
                this.incomingMessage("System", connectionType + " connection failed for " + streams);
            }
        };
        App.prototype.prepareConnection = function (connection) {
            var audioStream = connection.getAudioStream();
            if (audioStream) {
                audioStream.setOpusDisabled(this.opusDisabled);
                audioStream.setG722Disabled(this.g722Disabled);
                audioStream.setPcmuDisabled(this.pcmuDisabled);
                audioStream.setPcmaDisabled(this.pcmaDisabled);
            }
            var videoStream = connection.getVideoStream();
            if (videoStream) {
                videoStream.setVp8Disabled(this.vp8Disabled);
                videoStream.setVp9Disabled(this.vp9Disabled);
                videoStream.setH264Disabled(this.h264Disabled);
            }
        };
        App.prototype.prepareDataChannel = function () {
            var _this = this;
            var dc = new fm.liveswitch.DataChannel("data");
            var intervalID;
            var onStateChange = function (dataChannel) {
                if (dataChannel.getState() == fm.liveswitch.DataChannelState.Connected) {
                    intervalID = setInterval(function () { dataChannel.sendDataString("Hello World!"); }, 1000);
                }
                if (dataChannel.getState() == fm.liveswitch.DataChannelState.Closing || dataChannel.getState() == fm.liveswitch.DataChannelState.Failed) {
                    if (intervalID != null) {
                        clearInterval(intervalID);
                    }
                }
            };
            var onReceive = function (dataChannelReceiveArgs) {
                if (!_this.dataChannelConnected) {
                    if (dataChannelReceiveArgs.getDataString != null) {
                        _this.incomingMessage("System", "Data channel connection established. Received test message from server: " + dataChannelReceiveArgs.getDataString());
                    }
                    _this.dataChannelConnected = true;
                }
            };
            dc.addOnStateChange(onStateChange);
            dc.setOnReceive(onReceive);
            return dc;
        };
        App.prototype.toggleAudioMute = function () {
            var audioTrack = this.localMedia.getAudioTrack();
            if (!audioTrack) {
                return false;
            }
            audioTrack.setMuted(!audioTrack.getMuted());
            return audioTrack.getMuted();
        };
        App.prototype.toggleVideoMute = function () {
            var videoTrack = this.localMedia.getVideoTrack();
            if (!videoTrack) {
                return false;
            }
            videoTrack.setMuted(!videoTrack.getMuted());
            return videoTrack.getMuted();
        };
        App.prototype.toggleVideoPreview = function () {
            var lm = this.layoutManager;
            if (lm != null) {
                var videoPreview = lm.getLocalView();
                if (!videoPreview) {
                    return false;
                }
                if (videoPreview.style.display == 'none') {
                    videoPreview.style.display = '';
                    return true;
                }
                videoPreview.style.display = 'none';
                return false;
            }
            else {
                return false;
            }
        };
        App.prototype.changeAudioDevice = function (id, name) {
            return this.localMedia.changeAudioSourceInput(new fm.liveswitch.SourceInput(id, name));
        };
        App.prototype.changeVideoDevice = function (id, name) {
            return this.localMedia.changeVideoSourceInput(new fm.liveswitch.SourceInput(id, name));
        };
        App.prototype.changeSendEncodings = function (id) {
            var encoding = this.localMedia.getVideoEncodings()[parseInt(id)];
            encoding.setDeactivated(!encoding.getDeactivated());
            this.localMedia.setVideoEncodings(this.localMedia.getVideoEncodings()); // trigger update
            fm.liveswitch.Log.debug("Toggled local encoding: " + id + " to deactivated: " + encoding.getDeactivated());
        };
        App.prototype.changeReceiveEncodings = function (id) {
            var _loop_1 = function () {
                var connection = this_1.sfuDownstreamConnections[key];
                var encodings = connection.getRemoteConnectionInfo().getVideoStream().getSendEncodings();
                if (encodings && encodings.length > 1) {
                    config = connection.getConfig();
                    config.setRemoteVideoEncoding(encodings[parseInt(id)]);
                    connection.update(config).then(function (_) {
                        fm.liveswitch.Log.debug("Updated video encoding to: " + id + " for connection: " + connection.getId());
                    }).fail(function (ex) {
                        fm.liveswitch.Log.error("Could not change video stream encoding for connection: " + connection.getId(), ex);
                    });
                }
            };
            var this_1 = this, config;
            for (var key in this.sfuDownstreamConnections) {
                _loop_1();
            }
        };
        return App;
    }());
    chat.App = App;
})(chat || (chat = {}));

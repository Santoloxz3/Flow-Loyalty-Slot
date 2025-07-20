gdjs.MenuCode = {};
gdjs.MenuCode.localVariables = [];
gdjs.MenuCode.GDTitleObjects1= [];
gdjs.MenuCode.GDTitleObjects2= [];
gdjs.MenuCode.GDTitleObjects3= [];
gdjs.MenuCode.GDTitleObjects4= [];
gdjs.MenuCode.GDTitleObjects5= [];
gdjs.MenuCode.GDPlayButtonObjects1= [];
gdjs.MenuCode.GDPlayButtonObjects2= [];
gdjs.MenuCode.GDPlayButtonObjects3= [];
gdjs.MenuCode.GDPlayButtonObjects4= [];
gdjs.MenuCode.GDPlayButtonObjects5= [];
gdjs.MenuCode.GDPlayButtonTextObjects1= [];
gdjs.MenuCode.GDPlayButtonTextObjects2= [];
gdjs.MenuCode.GDPlayButtonTextObjects3= [];
gdjs.MenuCode.GDPlayButtonTextObjects4= [];
gdjs.MenuCode.GDPlayButtonTextObjects5= [];
gdjs.MenuCode.GDNewSpriteObjects1= [];
gdjs.MenuCode.GDNewSpriteObjects2= [];
gdjs.MenuCode.GDNewSpriteObjects3= [];
gdjs.MenuCode.GDNewSpriteObjects4= [];
gdjs.MenuCode.GDNewSpriteObjects5= [];
gdjs.MenuCode.GDOrangeBubbleButtonObjects1= [];
gdjs.MenuCode.GDOrangeBubbleButtonObjects2= [];
gdjs.MenuCode.GDOrangeBubbleButtonObjects3= [];
gdjs.MenuCode.GDOrangeBubbleButtonObjects4= [];
gdjs.MenuCode.GDOrangeBubbleButtonObjects5= [];
gdjs.MenuCode.GDPLAY_9595GAMEObjects1= [];
gdjs.MenuCode.GDPLAY_9595GAMEObjects2= [];
gdjs.MenuCode.GDPLAY_9595GAMEObjects3= [];
gdjs.MenuCode.GDPLAY_9595GAMEObjects4= [];
gdjs.MenuCode.GDPLAY_9595GAMEObjects5= [];
gdjs.MenuCode.GDTransition_9595SlotObjects1= [];
gdjs.MenuCode.GDTransition_9595SlotObjects2= [];
gdjs.MenuCode.GDTransition_9595SlotObjects3= [];
gdjs.MenuCode.GDTransition_9595SlotObjects4= [];
gdjs.MenuCode.GDTransition_9595SlotObjects5= [];
gdjs.MenuCode.GDNewSprite2Objects1= [];
gdjs.MenuCode.GDNewSprite2Objects2= [];
gdjs.MenuCode.GDNewSprite2Objects3= [];
gdjs.MenuCode.GDNewSprite2Objects4= [];
gdjs.MenuCode.GDNewSprite2Objects5= [];
gdjs.MenuCode.GDConnectObjects1= [];
gdjs.MenuCode.GDConnectObjects2= [];
gdjs.MenuCode.GDConnectObjects3= [];
gdjs.MenuCode.GDConnectObjects4= [];
gdjs.MenuCode.GDConnectObjects5= [];
gdjs.MenuCode.GDLOGO_9595SUIObjects1= [];
gdjs.MenuCode.GDLOGO_9595SUIObjects2= [];
gdjs.MenuCode.GDLOGO_9595SUIObjects3= [];
gdjs.MenuCode.GDLOGO_9595SUIObjects4= [];
gdjs.MenuCode.GDLOGO_9595SUIObjects5= [];
gdjs.MenuCode.GDTransparentButtonWithWhiteBlueBorderObjects1= [];
gdjs.MenuCode.GDTransparentButtonWithWhiteBlueBorderObjects2= [];
gdjs.MenuCode.GDTransparentButtonWithWhiteBlueBorderObjects3= [];
gdjs.MenuCode.GDTransparentButtonWithWhiteBlueBorderObjects4= [];
gdjs.MenuCode.GDTransparentButtonWithWhiteBlueBorderObjects5= [];
gdjs.MenuCode.GDBUYObjects1= [];
gdjs.MenuCode.GDBUYObjects2= [];
gdjs.MenuCode.GDBUYObjects3= [];
gdjs.MenuCode.GDBUYObjects4= [];
gdjs.MenuCode.GDBUYObjects5= [];
gdjs.MenuCode.GDSFONDO_9595FLOWObjects1= [];
gdjs.MenuCode.GDSFONDO_9595FLOWObjects2= [];
gdjs.MenuCode.GDSFONDO_9595FLOWObjects3= [];
gdjs.MenuCode.GDSFONDO_9595FLOWObjects4= [];
gdjs.MenuCode.GDSFONDO_9595FLOWObjects5= [];


gdjs.MenuCode.mapOfGDgdjs_9546MenuCode_9546GDTransition_95959595SlotObjects3Objects = Hashtable.newFrom({"Transition_Slot": gdjs.MenuCode.GDTransition_9595SlotObjects3});
gdjs.MenuCode.userFunc0xeb2d80 = function GDJSInlineCode(runtimeScene) {
"use strict";
window.parent.postMessage({ type: "REQUEST_BALANCE" }, "*");


};
gdjs.MenuCode.eventsList0 = function(runtimeScene, asyncObjectsList) {

{


gdjs.MenuCode.userFunc0xeb2d80(runtimeScene);

}


};gdjs.MenuCode.asyncCallback13539940 = function (runtimeScene, asyncObjectsList) {
asyncObjectsList.restoreLocalVariablesContainers(gdjs.MenuCode.localVariables);
{gdjs.evtTools.runtimeScene.replaceScene(runtimeScene, "SlotMachine", true);
}
{ //Subevents
gdjs.MenuCode.eventsList0(runtimeScene, asyncObjectsList);} //End of subevents
gdjs.MenuCode.localVariables.length = 0;
}
gdjs.MenuCode.eventsList1 = function(runtimeScene, asyncObjectsList) {

{


{
const parentAsyncObjectsList = asyncObjectsList;
{
const asyncObjectsList = gdjs.LongLivedObjectsList.from(parentAsyncObjectsList);
asyncObjectsList.backupLocalVariablesContainers(gdjs.MenuCode.localVariables);
runtimeScene.getAsyncTasksManager().addTask(gdjs.evtTools.runtimeScene.wait(0.5), (runtimeScene) => (gdjs.MenuCode.asyncCallback13539940(runtimeScene, asyncObjectsList)));
}
}

}


};gdjs.MenuCode.asyncCallback13537924 = function (runtimeScene, asyncObjectsList) {
asyncObjectsList.restoreLocalVariablesContainers(gdjs.MenuCode.localVariables);
gdjs.MenuCode.GDTransition_9595SlotObjects3.length = 0;

{gdjs.evtTools.object.createObjectOnScene((typeof eventsFunctionContext !== 'undefined' ? eventsFunctionContext : runtimeScene), gdjs.MenuCode.mapOfGDgdjs_9546MenuCode_9546GDTransition_95959595SlotObjects3Objects, 0, 0, "");
}{for(var i = 0, len = gdjs.MenuCode.GDTransition_9595SlotObjects3.length ;i < len;++i) {
    gdjs.MenuCode.GDTransition_9595SlotObjects3[i].getBehavior("FlashTransitionPainter").PaintEffect("0;0;0", 0.3, "Circular", "Forward", 0, (typeof eventsFunctionContext !== 'undefined' ? eventsFunctionContext : undefined));
}
}
{ //Subevents
gdjs.MenuCode.eventsList1(runtimeScene, asyncObjectsList);} //End of subevents
gdjs.MenuCode.localVariables.length = 0;
}
gdjs.MenuCode.eventsList2 = function(runtimeScene) {

{


{
{
const asyncObjectsList = new gdjs.LongLivedObjectsList();
asyncObjectsList.backupLocalVariablesContainers(gdjs.MenuCode.localVariables);
runtimeScene.getAsyncTasksManager().addTask(gdjs.evtTools.runtimeScene.wait(0.5), (runtimeScene) => (gdjs.MenuCode.asyncCallback13537924(runtimeScene, asyncObjectsList)));
}
}

}


};gdjs.MenuCode.eventsList3 = function(runtimeScene) {

{

gdjs.copyArray(runtimeScene.getObjects("PLAY_GAME"), gdjs.MenuCode.GDPLAY_9595GAMEObjects2);

let isConditionTrue_0 = false;
isConditionTrue_0 = false;
for (var i = 0, k = 0, l = gdjs.MenuCode.GDPLAY_9595GAMEObjects2.length;i<l;++i) {
    if ( gdjs.MenuCode.GDPLAY_9595GAMEObjects2[i].IsPressed((typeof eventsFunctionContext !== 'undefined' ? eventsFunctionContext : undefined)) ) {
        isConditionTrue_0 = true;
        gdjs.MenuCode.GDPLAY_9595GAMEObjects2[k] = gdjs.MenuCode.GDPLAY_9595GAMEObjects2[i];
        ++k;
    }
}
gdjs.MenuCode.GDPLAY_9595GAMEObjects2.length = k;
if (isConditionTrue_0) {
{gdjs.evtTools.sound.playSound(runtimeScene, "c52f1dacc263a2a6dc94e712a2a148f909b73372fa8e0622cb237fdc6a72fd6c_Coins 8.aac", false, 100, 1);
}
{ //Subevents
gdjs.MenuCode.eventsList2(runtimeScene);} //End of subevents
}

}


{

gdjs.copyArray(runtimeScene.getObjects("BUY"), gdjs.MenuCode.GDBUYObjects1);

let isConditionTrue_0 = false;
isConditionTrue_0 = false;
for (var i = 0, k = 0, l = gdjs.MenuCode.GDBUYObjects1.length;i<l;++i) {
    if ( gdjs.MenuCode.GDBUYObjects1[i].IsPressed((typeof eventsFunctionContext !== 'undefined' ? eventsFunctionContext : undefined)) ) {
        isConditionTrue_0 = true;
        gdjs.MenuCode.GDBUYObjects1[k] = gdjs.MenuCode.GDBUYObjects1[i];
        ++k;
    }
}
gdjs.MenuCode.GDBUYObjects1.length = k;
if (isConditionTrue_0) {
{gdjs.evtTools.window.openURL("https://app.turbos.finance/#/trade?input=0x2::sui::SUI&output=0x7c486f6723448de6c2a1515eb66fbc91d496063acfa0392b862aad11716ba960::mblub::MBLUB", runtimeScene);
}}

}


};gdjs.MenuCode.eventsList4 = function(runtimeScene) {

{


let isConditionTrue_0 = false;
isConditionTrue_0 = false;
isConditionTrue_0 = gdjs.evtTools.runtimeScene.sceneJustBegins(runtimeScene);
if (isConditionTrue_0) {
gdjs.copyArray(runtimeScene.getObjects("LOGO_SUI"), gdjs.MenuCode.GDLOGO_9595SUIObjects1);
{for(var i = 0, len = gdjs.MenuCode.GDLOGO_9595SUIObjects1.length ;i < len;++i) {
    gdjs.MenuCode.GDLOGO_9595SUIObjects1[i].getBehavior("ShakeObject_PositionAngle").ShakeObject_PositionAngle(20, 0, 5, 0, 1, true, (typeof eventsFunctionContext !== 'undefined' ? eventsFunctionContext : undefined));
}
}{gdjs.evtTools.advancedWindow.setFullScreenable(true, runtimeScene);
}}

}


{


let isConditionTrue_0 = false;
isConditionTrue_0 = false;
isConditionTrue_0 = gdjs.evtTools.input.isMouseButtonPressed(runtimeScene, "Left");
if (isConditionTrue_0) {
isConditionTrue_0 = false;
{isConditionTrue_0 = runtimeScene.getOnceTriggers().triggerOnce(13535972);
}
}
if (isConditionTrue_0) {

{ //Subevents
gdjs.MenuCode.eventsList3(runtimeScene);} //End of subevents
}

}


};

gdjs.MenuCode.func = function(runtimeScene) {
runtimeScene.getOnceTriggers().startNewFrame();

gdjs.MenuCode.GDTitleObjects1.length = 0;
gdjs.MenuCode.GDTitleObjects2.length = 0;
gdjs.MenuCode.GDTitleObjects3.length = 0;
gdjs.MenuCode.GDTitleObjects4.length = 0;
gdjs.MenuCode.GDTitleObjects5.length = 0;
gdjs.MenuCode.GDPlayButtonObjects1.length = 0;
gdjs.MenuCode.GDPlayButtonObjects2.length = 0;
gdjs.MenuCode.GDPlayButtonObjects3.length = 0;
gdjs.MenuCode.GDPlayButtonObjects4.length = 0;
gdjs.MenuCode.GDPlayButtonObjects5.length = 0;
gdjs.MenuCode.GDPlayButtonTextObjects1.length = 0;
gdjs.MenuCode.GDPlayButtonTextObjects2.length = 0;
gdjs.MenuCode.GDPlayButtonTextObjects3.length = 0;
gdjs.MenuCode.GDPlayButtonTextObjects4.length = 0;
gdjs.MenuCode.GDPlayButtonTextObjects5.length = 0;
gdjs.MenuCode.GDNewSpriteObjects1.length = 0;
gdjs.MenuCode.GDNewSpriteObjects2.length = 0;
gdjs.MenuCode.GDNewSpriteObjects3.length = 0;
gdjs.MenuCode.GDNewSpriteObjects4.length = 0;
gdjs.MenuCode.GDNewSpriteObjects5.length = 0;
gdjs.MenuCode.GDOrangeBubbleButtonObjects1.length = 0;
gdjs.MenuCode.GDOrangeBubbleButtonObjects2.length = 0;
gdjs.MenuCode.GDOrangeBubbleButtonObjects3.length = 0;
gdjs.MenuCode.GDOrangeBubbleButtonObjects4.length = 0;
gdjs.MenuCode.GDOrangeBubbleButtonObjects5.length = 0;
gdjs.MenuCode.GDPLAY_9595GAMEObjects1.length = 0;
gdjs.MenuCode.GDPLAY_9595GAMEObjects2.length = 0;
gdjs.MenuCode.GDPLAY_9595GAMEObjects3.length = 0;
gdjs.MenuCode.GDPLAY_9595GAMEObjects4.length = 0;
gdjs.MenuCode.GDPLAY_9595GAMEObjects5.length = 0;
gdjs.MenuCode.GDTransition_9595SlotObjects1.length = 0;
gdjs.MenuCode.GDTransition_9595SlotObjects2.length = 0;
gdjs.MenuCode.GDTransition_9595SlotObjects3.length = 0;
gdjs.MenuCode.GDTransition_9595SlotObjects4.length = 0;
gdjs.MenuCode.GDTransition_9595SlotObjects5.length = 0;
gdjs.MenuCode.GDNewSprite2Objects1.length = 0;
gdjs.MenuCode.GDNewSprite2Objects2.length = 0;
gdjs.MenuCode.GDNewSprite2Objects3.length = 0;
gdjs.MenuCode.GDNewSprite2Objects4.length = 0;
gdjs.MenuCode.GDNewSprite2Objects5.length = 0;
gdjs.MenuCode.GDConnectObjects1.length = 0;
gdjs.MenuCode.GDConnectObjects2.length = 0;
gdjs.MenuCode.GDConnectObjects3.length = 0;
gdjs.MenuCode.GDConnectObjects4.length = 0;
gdjs.MenuCode.GDConnectObjects5.length = 0;
gdjs.MenuCode.GDLOGO_9595SUIObjects1.length = 0;
gdjs.MenuCode.GDLOGO_9595SUIObjects2.length = 0;
gdjs.MenuCode.GDLOGO_9595SUIObjects3.length = 0;
gdjs.MenuCode.GDLOGO_9595SUIObjects4.length = 0;
gdjs.MenuCode.GDLOGO_9595SUIObjects5.length = 0;
gdjs.MenuCode.GDTransparentButtonWithWhiteBlueBorderObjects1.length = 0;
gdjs.MenuCode.GDTransparentButtonWithWhiteBlueBorderObjects2.length = 0;
gdjs.MenuCode.GDTransparentButtonWithWhiteBlueBorderObjects3.length = 0;
gdjs.MenuCode.GDTransparentButtonWithWhiteBlueBorderObjects4.length = 0;
gdjs.MenuCode.GDTransparentButtonWithWhiteBlueBorderObjects5.length = 0;
gdjs.MenuCode.GDBUYObjects1.length = 0;
gdjs.MenuCode.GDBUYObjects2.length = 0;
gdjs.MenuCode.GDBUYObjects3.length = 0;
gdjs.MenuCode.GDBUYObjects4.length = 0;
gdjs.MenuCode.GDBUYObjects5.length = 0;
gdjs.MenuCode.GDSFONDO_9595FLOWObjects1.length = 0;
gdjs.MenuCode.GDSFONDO_9595FLOWObjects2.length = 0;
gdjs.MenuCode.GDSFONDO_9595FLOWObjects3.length = 0;
gdjs.MenuCode.GDSFONDO_9595FLOWObjects4.length = 0;
gdjs.MenuCode.GDSFONDO_9595FLOWObjects5.length = 0;

gdjs.MenuCode.eventsList4(runtimeScene);
gdjs.MenuCode.GDTitleObjects1.length = 0;
gdjs.MenuCode.GDTitleObjects2.length = 0;
gdjs.MenuCode.GDTitleObjects3.length = 0;
gdjs.MenuCode.GDTitleObjects4.length = 0;
gdjs.MenuCode.GDTitleObjects5.length = 0;
gdjs.MenuCode.GDPlayButtonObjects1.length = 0;
gdjs.MenuCode.GDPlayButtonObjects2.length = 0;
gdjs.MenuCode.GDPlayButtonObjects3.length = 0;
gdjs.MenuCode.GDPlayButtonObjects4.length = 0;
gdjs.MenuCode.GDPlayButtonObjects5.length = 0;
gdjs.MenuCode.GDPlayButtonTextObjects1.length = 0;
gdjs.MenuCode.GDPlayButtonTextObjects2.length = 0;
gdjs.MenuCode.GDPlayButtonTextObjects3.length = 0;
gdjs.MenuCode.GDPlayButtonTextObjects4.length = 0;
gdjs.MenuCode.GDPlayButtonTextObjects5.length = 0;
gdjs.MenuCode.GDNewSpriteObjects1.length = 0;
gdjs.MenuCode.GDNewSpriteObjects2.length = 0;
gdjs.MenuCode.GDNewSpriteObjects3.length = 0;
gdjs.MenuCode.GDNewSpriteObjects4.length = 0;
gdjs.MenuCode.GDNewSpriteObjects5.length = 0;
gdjs.MenuCode.GDOrangeBubbleButtonObjects1.length = 0;
gdjs.MenuCode.GDOrangeBubbleButtonObjects2.length = 0;
gdjs.MenuCode.GDOrangeBubbleButtonObjects3.length = 0;
gdjs.MenuCode.GDOrangeBubbleButtonObjects4.length = 0;
gdjs.MenuCode.GDOrangeBubbleButtonObjects5.length = 0;
gdjs.MenuCode.GDPLAY_9595GAMEObjects1.length = 0;
gdjs.MenuCode.GDPLAY_9595GAMEObjects2.length = 0;
gdjs.MenuCode.GDPLAY_9595GAMEObjects3.length = 0;
gdjs.MenuCode.GDPLAY_9595GAMEObjects4.length = 0;
gdjs.MenuCode.GDPLAY_9595GAMEObjects5.length = 0;
gdjs.MenuCode.GDTransition_9595SlotObjects1.length = 0;
gdjs.MenuCode.GDTransition_9595SlotObjects2.length = 0;
gdjs.MenuCode.GDTransition_9595SlotObjects3.length = 0;
gdjs.MenuCode.GDTransition_9595SlotObjects4.length = 0;
gdjs.MenuCode.GDTransition_9595SlotObjects5.length = 0;
gdjs.MenuCode.GDNewSprite2Objects1.length = 0;
gdjs.MenuCode.GDNewSprite2Objects2.length = 0;
gdjs.MenuCode.GDNewSprite2Objects3.length = 0;
gdjs.MenuCode.GDNewSprite2Objects4.length = 0;
gdjs.MenuCode.GDNewSprite2Objects5.length = 0;
gdjs.MenuCode.GDConnectObjects1.length = 0;
gdjs.MenuCode.GDConnectObjects2.length = 0;
gdjs.MenuCode.GDConnectObjects3.length = 0;
gdjs.MenuCode.GDConnectObjects4.length = 0;
gdjs.MenuCode.GDConnectObjects5.length = 0;
gdjs.MenuCode.GDLOGO_9595SUIObjects1.length = 0;
gdjs.MenuCode.GDLOGO_9595SUIObjects2.length = 0;
gdjs.MenuCode.GDLOGO_9595SUIObjects3.length = 0;
gdjs.MenuCode.GDLOGO_9595SUIObjects4.length = 0;
gdjs.MenuCode.GDLOGO_9595SUIObjects5.length = 0;
gdjs.MenuCode.GDTransparentButtonWithWhiteBlueBorderObjects1.length = 0;
gdjs.MenuCode.GDTransparentButtonWithWhiteBlueBorderObjects2.length = 0;
gdjs.MenuCode.GDTransparentButtonWithWhiteBlueBorderObjects3.length = 0;
gdjs.MenuCode.GDTransparentButtonWithWhiteBlueBorderObjects4.length = 0;
gdjs.MenuCode.GDTransparentButtonWithWhiteBlueBorderObjects5.length = 0;
gdjs.MenuCode.GDBUYObjects1.length = 0;
gdjs.MenuCode.GDBUYObjects2.length = 0;
gdjs.MenuCode.GDBUYObjects3.length = 0;
gdjs.MenuCode.GDBUYObjects4.length = 0;
gdjs.MenuCode.GDBUYObjects5.length = 0;
gdjs.MenuCode.GDSFONDO_9595FLOWObjects1.length = 0;
gdjs.MenuCode.GDSFONDO_9595FLOWObjects2.length = 0;
gdjs.MenuCode.GDSFONDO_9595FLOWObjects3.length = 0;
gdjs.MenuCode.GDSFONDO_9595FLOWObjects4.length = 0;
gdjs.MenuCode.GDSFONDO_9595FLOWObjects5.length = 0;


return;

}

gdjs['MenuCode'] = gdjs.MenuCode;

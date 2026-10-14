gdjs.GameOverCode = {};
gdjs.GameOverCode.localVariables = [];
gdjs.GameOverCode.GDTitleObjects1= [];
gdjs.GameOverCode.GDTitleObjects2= [];
gdjs.GameOverCode.GDBorrowButtonObjects1= [];
gdjs.GameOverCode.GDBorrowButtonObjects2= [];
gdjs.GameOverCode.GDBorrowButtonTextObjects1= [];
gdjs.GameOverCode.GDBorrowButtonTextObjects2= [];
gdjs.GameOverCode.GDNewSpriteObjects1= [];
gdjs.GameOverCode.GDNewSpriteObjects2= [];
gdjs.GameOverCode.GDNewSprite2Objects1= [];
gdjs.GameOverCode.GDNewSprite2Objects2= [];
gdjs.GameOverCode.GDNewSprite3Objects1= [];
gdjs.GameOverCode.GDNewSprite3Objects2= [];
gdjs.GameOverCode.GDsfondoObjects1= [];
gdjs.GameOverCode.GDsfondoObjects2= [];


gdjs.GameOverCode.mapOfGDgdjs_9546GameOverCode_9546GDBorrowButtonObjects1Objects = Hashtable.newFrom({"BorrowButton": gdjs.GameOverCode.GDBorrowButtonObjects1});
gdjs.GameOverCode.eventsList0 = function(runtimeScene) {

{

gdjs.copyArray(runtimeScene.getObjects("BorrowButton"), gdjs.GameOverCode.GDBorrowButtonObjects1);

let isConditionTrue_0 = false;
isConditionTrue_0 = false;
isConditionTrue_0 = gdjs.evtTools.input.cursorOnObject(gdjs.GameOverCode.mapOfGDgdjs_9546GameOverCode_9546GDBorrowButtonObjects1Objects, runtimeScene, true, false);
if (isConditionTrue_0) {
{gdjs.evtTools.runtimeScene.replaceScene(runtimeScene, "SlotMachine", true);
}}

}


};gdjs.GameOverCode.eventsList1 = function(runtimeScene) {

{


let isConditionTrue_0 = false;
isConditionTrue_0 = false;
isConditionTrue_0 = gdjs.evtTools.input.isMouseButtonPressed(runtimeScene, "Left");
if (isConditionTrue_0) {
isConditionTrue_0 = false;
{isConditionTrue_0 = runtimeScene.getOnceTriggers().triggerOnce(13902868);
}
}
if (isConditionTrue_0) {

{ //Subevents
gdjs.GameOverCode.eventsList0(runtimeScene);} //End of subevents
}

}


};

gdjs.GameOverCode.func = function(runtimeScene) {
runtimeScene.getOnceTriggers().startNewFrame();

gdjs.GameOverCode.GDTitleObjects1.length = 0;
gdjs.GameOverCode.GDTitleObjects2.length = 0;
gdjs.GameOverCode.GDBorrowButtonObjects1.length = 0;
gdjs.GameOverCode.GDBorrowButtonObjects2.length = 0;
gdjs.GameOverCode.GDBorrowButtonTextObjects1.length = 0;
gdjs.GameOverCode.GDBorrowButtonTextObjects2.length = 0;
gdjs.GameOverCode.GDNewSpriteObjects1.length = 0;
gdjs.GameOverCode.GDNewSpriteObjects2.length = 0;
gdjs.GameOverCode.GDNewSprite2Objects1.length = 0;
gdjs.GameOverCode.GDNewSprite2Objects2.length = 0;
gdjs.GameOverCode.GDNewSprite3Objects1.length = 0;
gdjs.GameOverCode.GDNewSprite3Objects2.length = 0;
gdjs.GameOverCode.GDsfondoObjects1.length = 0;
gdjs.GameOverCode.GDsfondoObjects2.length = 0;

gdjs.GameOverCode.eventsList1(runtimeScene);
gdjs.GameOverCode.GDTitleObjects1.length = 0;
gdjs.GameOverCode.GDTitleObjects2.length = 0;
gdjs.GameOverCode.GDBorrowButtonObjects1.length = 0;
gdjs.GameOverCode.GDBorrowButtonObjects2.length = 0;
gdjs.GameOverCode.GDBorrowButtonTextObjects1.length = 0;
gdjs.GameOverCode.GDBorrowButtonTextObjects2.length = 0;
gdjs.GameOverCode.GDNewSpriteObjects1.length = 0;
gdjs.GameOverCode.GDNewSpriteObjects2.length = 0;
gdjs.GameOverCode.GDNewSprite2Objects1.length = 0;
gdjs.GameOverCode.GDNewSprite2Objects2.length = 0;
gdjs.GameOverCode.GDNewSprite3Objects1.length = 0;
gdjs.GameOverCode.GDNewSprite3Objects2.length = 0;
gdjs.GameOverCode.GDsfondoObjects1.length = 0;
gdjs.GameOverCode.GDsfondoObjects2.length = 0;


return;

}

gdjs['GameOverCode'] = gdjs.GameOverCode;

$(document).ready(function() {
  $('div.hidden').fadeIn(1000).removeClass('hidden');

  $("GLMIexplanation").hide();

  $("#moreGLMI").click(function(){
    $("#GLMIexplanation").fadeIn(1000);
    $("#moreGLMI").hide();
  });

  $("#lessGLMI").click(function(){
    $("#GLMIexplanation").hide();
    $("#moreGLMI").fadeIn(500);
  });
});
